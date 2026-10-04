/**
 * Headlines marked [data-steep] are split into words that steep from a pale tea wash
 * to ink as they scroll into view (BRIEF.md §5 #3).
 */
export function initSteep() {
  const els = document.querySelectorAll<HTMLElement>('[data-steep]');
  if (!els.length) return;

  for (const el of els) {
    if (el.dataset.split) continue;
    el.dataset.split = '';
    el.setAttribute('aria-label', el.textContent?.trim() ?? '');
    const words = (el.textContent ?? '').trim().split(/\s+/);
    el.innerHTML = words
      .map((w, i) => `<span class="w" style="--i:${i}" aria-hidden="true">${escape(w)}</span>`)
      .join(' ');
  }

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
