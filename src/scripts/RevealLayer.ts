/**
 * RevealLayer: the "look closer" mechanic from BRIEF.md §3.
 *
 * Markup contract (see src/components/Reveal.astro):
 *   <div data-reveal>                       root, aspect-ratio must match both images
 *     <img class="reveal__bottom" alt="…">  the layer underneath (real content)
 *     <img class="reveal__top" alt="">      the surface; drawn into the canvas once JS runs
 *     <canvas class="reveal__canvas">
 *   </div>
 *   <button data-reveal-toggle="<root id>"> optional keyboard / touch alternative
 *
 * The pointer paints into an offscreen mask; the mask is cut out of the surface with
 * `destination-out`, and slowly fades again ("re-steeps") once the pointer goes idle.
 *
 * Events dispatched on the root: reveal:first, reveal:payoff, reveal:open, reveal:resteep
 */

const TAU = Math.PI * 2;

export interface RevealOptions {
  /** brush radius as a fraction of the layer width */
  brush: number;
  /** ms after the last stroke before the surface starts to re-steep */
  resteepDelay: number;
  /** ms for a full re-steep */
  resteepDuration: number;
  /** fraction (0–1) of the bottom layer's footprint to uncover before the bloom; 0 disables */
  payoff: number;
  /** ms the layer stays fully open after a bloom; 0 keeps it open until toggled */
  hold: number;
  /** play a ghost "stir" if nobody interacts within this many ms; 0 disables */
  autoStir: number;
}

const DEFAULTS: RevealOptions = {
  brush: 0.11,
  resteepDelay: 1400,
  resteepDuration: 1600,
  payoff: 0,
  hold: 0,
  autoStir: 0,
};

type State = 'idle' | 'bloom' | 'open';
type OpenSource = 'pointer' | 'payoff' | 'toggle';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** A soft round dab, rendered once and stamped many times. */
function makeBrush(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.95)');
  grad.addColorStop(0.8, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

let brushSprite: HTMLCanvasElement | null = null;

export class RevealLayer {
  readonly root: HTMLElement;
  private opts: RevealOptions;
  private top: HTMLImageElement;
  private bottom: HTMLImageElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mask = document.createElement('canvas');
  private mctx = this.mask.getContext('2d')!;
  private toggleBtn: HTMLButtonElement | null;
  /** optional paint under the surface image (CSS --reveal-surface), so transparent parts of it still hide the layer below */
  private surface = '';
  private ghost: HTMLElement | null = null;

  private w = 0;
  private h = 0;
  private state: State = 'idle';
  private dirty = false; // mask has something in it
  private last: { x: number; y: number } | null = null;
  private lastInput = 0;
  private fadeElapsed = 0;
  private prevFrame = 0;
  private raf = 0;
  private interacted = false;
  private reduced = reducedMotion();

  private openSource: OpenSource = 'toggle';
  private bloomFrom = { x: 0.5, y: 0.5 };
  private bloomStart = 0;
  private holdTimer = 0;
  private stirTimer = 0;
  private stirStart = 0;

  // coverage tracking for the payoff
  private gridW = 32;
  private gridH = 18;
  private footprint: Uint8Array | null = null;
  private footprintCount = 0;
  private seen: Uint8Array | null = null;
  private lastSample = 0;
  private sampleCanvas = document.createElement('canvas');
  private payoffDone = false;

  constructor(root: HTMLElement, opts: Partial<RevealOptions> = {}) {
    this.root = root;
    this.opts = { ...DEFAULTS, ...opts };
    this.top = root.querySelector<HTMLImageElement>('.reveal__top')!;
    this.bottom = root.querySelector<HTMLImageElement>('.reveal__bottom')!;
    this.canvas = root.querySelector<HTMLCanvasElement>('.reveal__canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.toggleBtn = root.id
      ? document.querySelector<HTMLButtonElement>(`[data-reveal-toggle="${root.id}"]`)
      : null;
    brushSprite ??= makeBrush();
    this.init();
  }

  static fromDataset(root: HTMLElement): RevealLayer {
    const d = root.dataset;
    const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));
    const opts: Partial<RevealOptions> = {};
    for (const [key, val] of Object.entries({
      brush: num(d.brush),
      resteepDelay: num(d.resteepDelay),
      resteepDuration: num(d.resteepDuration),
      payoff: num(d.payoff),
      hold: num(d.hold),
      autoStir: num(d.autoStir),
    })) {
      if (val !== undefined && !Number.isNaN(val)) (opts as Record<string, number>)[key] = val;
    }
    return new RevealLayer(root, opts);
  }

  private async init() {
    await Promise.all([this.top, this.bottom].map((img) => img.decode().catch(() => {})));

    this.surface = getComputedStyle(this.root).getPropertyValue('--reveal-surface').trim();
    new ResizeObserver(() => this.resize()).observe(this.root);
    this.resize();
    this.buildFootprint();
    this.root.dataset.ready = '';
    this.root.dataset.state = this.state;

    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerdown', this.onMove);
    this.root.addEventListener('pointerleave', this.onLeave);
    this.root.addEventListener('pointercancel', this.onLeave);
    this.toggleBtn?.addEventListener('click', () => this.toggle());
    this.root.addEventListener('click', () => {
      if (this.state === 'open' && this.openSource === 'payoff') this.resteep();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state !== 'idle') this.resteep();
    });
    window
      .matchMedia('(prefers-reduced-motion: reduce)')
      .addEventListener('change', (e) => (this.reduced = e.matches));

    if (this.opts.autoStir > 0 && !this.reduced) {
      this.stirTimer = window.setTimeout(() => this.startStir(), this.opts.autoStir);
    }
  }

  // ---------- sizing ----------

  private resize() {
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);

    // keep whatever is revealed while resizing
    const prev = this.dirty ? this.copyMask() : null;
    this.mask.width = Math.max(1, Math.round(this.canvas.width / 2));
    this.mask.height = Math.max(1, Math.round(this.canvas.height / 2));
    if (this.state === 'open') this.fillMask();
    else if (prev) this.mctx.drawImage(prev, 0, 0, this.mask.width, this.mask.height);
    this.render();
  }

  private copyMask() {
    const c = document.createElement('canvas');
    c.width = this.mask.width;
    c.height = this.mask.height;
    c.getContext('2d')!.drawImage(this.mask, 0, 0);
    return c;
  }

  /** Which grid cells actually contain the bottom artwork. */
  private buildFootprint() {
    if (!this.opts.payoff) return;
    const aspect = this.bottom.naturalHeight / this.bottom.naturalWidth || 9 / 16;
    this.gridH = Math.max(8, Math.round(this.gridW * aspect));
    const c = this.sampleCanvas;
    c.width = this.gridW;
    c.height = this.gridH;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(this.bottom, 0, 0, this.gridW, this.gridH);
    const data = g.getImageData(0, 0, this.gridW, this.gridH).data;
    this.footprint = new Uint8Array(this.gridW * this.gridH);
    this.seen = new Uint8Array(this.gridW * this.gridH);
    for (let i = 0; i < this.footprint.length; i++) {
      if (data[i * 4 + 3] > 60) {
        this.footprint[i] = 1;
        this.footprintCount++;
      }
    }
  }

  private setState(state: State) {
    this.state = state;
    this.root.dataset.state = state;
  }

  // ---------- input ----------

  private local(e: PointerEvent) {
    const rect = this.root.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onMove = (e: PointerEvent) => {
    const p = this.local(e);
    this.markInteracted();

    if (this.reduced) {
      // no painting: a simple crossfade of the whole surface instead
      if (this.state === 'idle') this.open('pointer');
      return;
    }
    if (this.state !== 'idle') return;

    const from = e.type === 'pointerdown' || !this.last ? p : this.last;
    this.stroke(from, p, this.opts.brush);
    this.last = p;
    this.lastInput = performance.now();
    this.fadeElapsed = 0;
    this.request();
  };

  private onLeave = () => {
    this.last = null;
    if (this.reduced && this.state === 'open' && this.openSource === 'pointer') {
      this.resteep();
    }
  };

  private markInteracted() {
    if (this.interacted) return;
    this.interacted = true;
    this.root.dataset.touched = '';
    clearTimeout(this.stirTimer);
    this.root.dispatchEvent(new CustomEvent('reveal:first'));
  }

  // ---------- painting ----------

  private stroke(a: { x: number; y: number }, b: { x: number; y: number }, brushFrac: number) {
    const sx = this.mask.width / this.w;
    const sy = this.mask.height / this.h;
    const r = brushFrac * this.mask.width;
    const dx = (b.x - a.x) * sx;
    const dy = (b.y - a.y) * sy;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (r * 0.3)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.dab(a.x * sx + dx * t, a.y * sy + dy * t, r);
    }
    this.dirty = true;
  }

  /** One wet dab: a soft core plus a few satellites so the edge soaks unevenly. */
  private dab(x: number, y: number, r: number) {
    const c = this.mctx;
    const s = brushSprite!;
    const rr = r * (0.88 + Math.random() * 0.24);
    c.drawImage(s, x - rr, y - rr, rr * 2, rr * 2);
    for (let i = 0; i < 2; i++) {
      const ang = Math.random() * TAU;
      const d = rr * (0.5 + Math.random() * 0.45);
      const sr = rr * (0.22 + Math.random() * 0.28);
      c.drawImage(s, x + Math.cos(ang) * d - sr, y + Math.sin(ang) * d - sr, sr * 2, sr * 2);
    }
  }

  private fillMask() {
    this.mctx.globalCompositeOperation = 'source-over';
    this.mctx.fillStyle = '#000';
    this.mctx.fillRect(0, 0, this.mask.width, this.mask.height);
    this.dirty = true;
  }

  private clearMask() {
    this.mctx.clearRect(0, 0, this.mask.width, this.mask.height);
    this.dirty = false;
  }

  // ---------- states ----------

  /** Fully reveal the layer underneath (bloom, or a crossfade with reduced motion). */
  open(source: OpenSource, origin?: { x: number; y: number }) {
    clearTimeout(this.holdTimer);
    this.cancelStir();
    this.openSource = source;
    if (this.reduced) {
      this.setState('open');
      this.fillMask();
      this.root.classList.add('is-open');
      this.render();
      this.afterOpen();
      return;
    }
    const o = origin ?? this.last ?? { x: this.w / 2, y: this.h / 2 };
    this.bloomFrom = { x: o.x / this.w, y: o.y / this.h };
    this.bloomStart = performance.now();
    this.setState('bloom');
    this.request();
  }

  private afterOpen() {
    this.toggleBtn?.setAttribute('aria-pressed', 'true');
    this.root.dispatchEvent(new CustomEvent('reveal:open'));
    if (!this.payoffDone && this.opts.payoff) this.firePayoff();
    if (this.opts.hold > 0 && this.openSource === 'payoff') {
      this.holdTimer = window.setTimeout(() => this.resteep(), this.opts.hold);
    }
  }

  /** Let the surface seep back. */
  resteep() {
    clearTimeout(this.holdTimer);
    this.root.classList.remove('is-open');
    this.toggleBtn?.setAttribute('aria-pressed', 'false');
    if (this.state === 'idle' && !this.dirty) return;
    this.setState('idle');
    this.root.dispatchEvent(new CustomEvent('reveal:resteep'));
    if (this.reduced) {
      this.clearMask();
      this.render();
      return;
    }
    this.lastInput = performance.now() - this.opts.resteepDelay;
    this.fadeElapsed = 0;
    this.request();
  }

  toggle() {
    this.markInteracted();
    if (this.state === 'idle') this.open('toggle', { x: this.w / 2, y: this.h / 2 });
    else this.resteep();
  }

  private firePayoff() {
    this.payoffDone = true;
    this.root.dispatchEvent(new CustomEvent('reveal:payoff'));
  }

  // ---------- auto stir ----------

  private startStir() {
    if (this.interacted || this.state !== 'idle' || this.reduced) return;
    this.ghost = document.createElement('span');
    this.ghost.className = 'reveal__ghost';
    this.ghost.setAttribute('aria-hidden', 'true');
    this.root.append(this.ghost);
    this.stirStart = performance.now();
    this.last = null;
    this.request();
  }

  private stepStir(now: number): boolean {
    const DURATION = 1900;
    const t = Math.min(1, (now - this.stirStart) / DURATION);
    // a loose spiral around the middle of the artwork
    const turns = 1.6;
    const ang = -Math.PI / 2 + t * turns * TAU;
    const rad = (0.06 + 0.16 * easeOutCubic(t)) * Math.min(this.w, this.h);
    const p = { x: this.w / 2 + Math.cos(ang) * rad, y: this.h / 2 + Math.sin(ang) * rad * 0.9 };
    this.stroke(this.last ?? p, p, this.opts.brush * 0.75);
    this.last = p;
    this.lastInput = now;
    this.fadeElapsed = 0;
    if (this.ghost) {
      this.ghost.style.transform = `translate(${p.x}px, ${p.y}px)`;
      this.ghost.style.opacity = t < 0.85 ? '1' : String((1 - t) / 0.15);
    }
    if (t >= 1) {
      this.cancelStir();
      return false;
    }
    return true;
  }

  private cancelStir() {
    if (!this.stirStart) return;
    this.stirStart = 0;
    this.last = null;
    this.ghost?.remove();
    this.ghost = null;
  }

  // ---------- loop ----------

  private request() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    const dt = this.prevFrame ? Math.min(64, now - this.prevFrame) : 16;
    this.prevFrame = now;
    let active = false;

    if (this.stirStart) {
      if (this.interacted) this.cancelStir();
      else active = this.stepStir(now) || active;
    }

    if (this.state === 'bloom') {
      active = this.stepBloom(now) || active;
    } else if (this.state === 'idle' && this.dirty) {
      if (now - this.lastInput > this.opts.resteepDelay) this.fade(dt);
      active = this.dirty || active;
    }

    if (this.opts.payoff && !this.payoffDone && this.state === 'idle' && now - this.lastSample > 200) {
      this.lastSample = now;
      if (this.interacted) this.sampleCoverage();
    }

    this.render();
    if (active) this.request();
    else this.prevFrame = 0;
  };

  private fade(dt: number) {
    const D = this.opts.resteepDuration;
    this.fadeElapsed += dt;
    if (this.fadeElapsed >= D) {
      this.clearMask();
      return;
    }
    // exponential decay to ~1% over D; the final clear removes 8-bit rounding residue
    const k = 1 - Math.pow(0.01, dt / D);
    this.mctx.globalCompositeOperation = 'destination-out';
    this.mctx.fillStyle = `rgba(0,0,0,${k})`;
    this.mctx.fillRect(0, 0, this.mask.width, this.mask.height);
    this.mctx.globalCompositeOperation = 'source-over';
  }

  private stepBloom(now: number): boolean {
    const DURATION = 950;
    const t = Math.min(1, (now - this.bloomStart) / DURATION);
    const mw = this.mask.width;
    const mh = this.mask.height;
    const cx = this.bloomFrom.x * mw;
    const cy = this.bloomFrom.y * mh;
    const maxR = Math.hypot(Math.max(cx, mw - cx), Math.max(cy, mh - cy)) * 1.15;
    const R = maxR * easeOutCubic(t);

    const c = this.mctx;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(cx, cy, R * 0.82, 0, TAU);
    c.fill();
    // ragged liquid front
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * TAU;
      const d = R * (0.75 + Math.random() * 0.25);
      this.dab(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, R * (0.12 + Math.random() * 0.14) + 4);
    }
    this.dirty = true;

    if (t >= 1) {
      this.fillMask();
      this.setState('open');
      this.afterOpen();
      return false;
    }
    return true;
  }

  private sampleCoverage() {
    if (!this.footprint || !this.seen || !this.footprintCount) return;
    const g = this.sampleCanvas.getContext('2d', { willReadFrequently: true })!;
    g.clearRect(0, 0, this.gridW, this.gridH);
    g.drawImage(this.mask, 0, 0, this.gridW, this.gridH);
    const data = g.getImageData(0, 0, this.gridW, this.gridH).data;
    let count = 0;
    for (let i = 0; i < this.seen.length; i++) {
      if (this.footprint[i] && data[i * 4 + 3] > 120) this.seen[i] = 1;
      if (this.seen[i]) count++;
    }
    if (count / this.footprintCount >= this.opts.payoff) this.open('payoff');
  }

  private render() {
    const { ctx, canvas } = this;
    if (!canvas.width) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.surface) {
      ctx.fillStyle = this.surface;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(this.top, 0, 0, canvas.width, canvas.height);
    if (this.dirty) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(this.mask, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/** Initialise every [data-reveal] on the page. */
export function initReveals(): RevealLayer[] {
  return [...document.querySelectorAll<HTMLElement>('[data-reveal]')].map((el) =>
    RevealLayer.fromDataset(el),
  );
}
