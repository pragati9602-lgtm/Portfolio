# Portfolio Build Brief: "Steeped"

> **For Claude Code:** this is the source of truth for the portfolio. Read it fully before writing code. Build in the phases in §10, and finish each phase's acceptance checks before moving on. Put anything still unknown under **Open questions (§12)**. Don't invent biography, clients or project facts.

---

## 1. The idea in one line

**Every design has a story steeped into it, and I've looked at enough of them to see what's underneath.**

The whole site runs on one metaphor: **layers**. The surface is a chai stain, the kind of everyday mark most people ignore. Look closer (move your cursor) and you find the illustration under it. Branding and storytelling work the same way: what you see first is the surface, and the meaning sits a layer below. The site should make visitors *do* that discovery, not just read about it.

Working title: **Steeped** (chai steeps; stories steep into designs). It's only a placeholder. Swap in your name or another title freely.

### Tone
- Warm, curious, tactile, a bit playful. Think paper, tea, a sketchbook left open on a café table.
- Confident, not loud. There's one signature interaction (the hero reveal), and everything else supports it.
- Writing is first person and plain, with small handwritten-style margin notes.

### Who it's for & what it must do
| Audience | They need to… |
|---|---|
| Recruiters / hiring managers (agency, in-house brand teams) | Understand who you are in under 10 s, reach work in 1 click, find contact + résumé fast |
| Creative directors | See thinking and process: *why*, not just *what* |
| Potential freelance clients | Trust you with their brand story |

**Success = the visitor plays with the hero, remembers the chai stain, and opens at least one case study.**

---

## 2. Site map

```
/                 Landing: chai-stain reveal hero → intro → selected work → field notes teaser → contact
/work             All projects (grid, filterable by Branding / Illustration / Packaging / Editorial, etc.)
/work/[slug]      Case study, structured as layers (see §6)
/notes            "Field Notes": short annotated breakdowns of other brands' hidden stories (see §7)
/about            Who you are, how you work, the chai ritual, résumé download
/contact          (or a footer section) email, LinkedIn, Behance/Instagram, availability
404               A spilled cup: "This page didn't steep." + link home
```

Header nav: logo/wordmark (left) · Work · Notes · About · Contact (right). Footer repeats contact + "brewed with chai & curiosity".

---

## 3. Landing hero: the chai-stain reveal (signature interaction)

### 3.1 What the visitor experiences
1. The page loads on warm paper. A **chai stain** sits centered, slightly rotated, with a faint paper texture behind it. Headline + tagline beside or below it (desktop: left text / right stain; mobile: stacked).
2. The cursor becomes a **small soft circle** (≈ 24 px, translucent tea colour) with a tiny handwritten label "look closer" that fades after the first movement.
3. When the cursor moves over the stain, a **soft-edged, slightly irregular "wet" hole** follows it and erases the stain, **revealing the colourful illustration underneath** (orange slice, sleeping figure, food icons).
4. The revealed area **slowly re-steeps** (the stain seeps back) about 1.2–2 s after the cursor leaves, so the interaction is endlessly replayable and never "used up".
5. **Discovery payoff:** once the visitor has revealed roughly 40% of the illustration in total (cumulative, tracked in a low-res grid), the stain **blooms away fully** in one liquid ripple (~900 ms). The illustration stays fully visible for a beat, and a handwritten note appears next to it:
   *"See? There's always something underneath."*
   After ~4 s, or on click, the stain gently re-steeps so the next visitor gets the same surprise. Fire this payoff **once per session**.
6. A small scroll cue at the bottom ("scroll to see more layers ↓") appears after the payoff, or after 5 s, whichever comes first.

### 3.2 Hero copy (draft, editable)
- **H1:** "Every design has a story steeped in it."
- **Sub:** "I'm [Name], a brand & illustration designer. I look at designs long enough to start seeing the stories underneath. Move your cursor over the stain."
- **CTA buttons:** `See the work` · `Say hello`

### 3.3 How to build it (technical spec)
- **Layering (bottom → top):**
  1. `<img>` illustration (`assets/hero/illustration.webp`), the real content with proper `alt`.
  2. `<canvas>` showing the stain, with the reveal mask cut out of it.
  3. Decorative overlay: subtle paper grain (CSS noise / SVG `feTurbulence`) with `mix-blend-mode: multiply` so both layers feel printed on the same paper.
- **Mask technique:**
  - Keep an offscreen **mask canvas** (half resolution is fine for performance).
  - Each `pointermove` stamps a **radial gradient** brush (radius ≈ 70–90 px desktop, scaled to the hero size) into the mask. Interpolate between the last and current pointer positions so fast movements leave a continuous trail, not dots.
  - Make the brush edge **organic**: jitter the radius with a little noise per stamp, or run the mask through an SVG `feTurbulence` + `feDisplacementMap` so the edge looks like liquid soaking paper, not a perfect circle.
  - **Re-steep:** every frame, fade the mask toward opaque by a small amount (e.g. fill with `rgba(0,0,0,0.02)` using `source-over`) once the pointer has been idle for the delay.
  - Composite: draw stain → apply mask with `destination-out` → output to the visible canvas. Loop with `requestAnimationFrame` **only while something is changing**, and stop the loop when idle.
- **Tracking for the payoff:** sample the mask into a coarse grid (e.g. 32×18) every ~250 ms, and count cells revealed *over the illustration's footprint*.
- **Bloom-away:** animate a growing noisy radial mask from the last pointer position (or the center) to full coverage. GSAP or a hand-written tween both work.
- **Sizing:** both images share the same artboard and alignment. Draw both with identical `object-fit: contain` math so they stay perfectly registered at every viewport size. Handle `devicePixelRatio` (cap at 2) and `ResizeObserver`.
- **Touch / mobile:** dragging a finger reveals in the same way (`pointer` events, `touch-action: pan-y` on the hero so vertical scroll still works). On load with no interaction after ~2.5 s, play a short **auto "stir"**: a ghost cursor traces a small spiral and reveals a peek, which teaches the gesture.
- **Keyboard / no pointer:** a visually subtle "Reveal the story" button (focusable, `aria-pressed`) triggers the bloom-away. `Esc` re-steeps.
- **`prefers-reduced-motion`:** no auto-stir, no ripple. Hover reveals instantly with a short crossfade, and the button still works.
- **No JS:** show the illustration with the stain as a static, slightly transparent overlay. The page must never be blank.
- **Accessibility:** canvas gets `aria-hidden="true"`; the `<img>` underneath carries the description, e.g. *"Illustration of a person asleep on a giant orange slice, surrounded by burgers, donuts, pizza and popcorn, hidden beneath a chai stain."*

### 3.4 Asset notes (important)
- The files currently in `assets/hero/` are **placeholders** exported on white backgrounds. For the final build, export **both on the same artboard size (e.g. 2400×1350) with transparent backgrounds** as WebP (with alpha) plus a PNG fallback, perfectly aligned.
- Until then, use `mix-blend-mode: multiply` on the stain/illustration so the white areas disappear into the paper background.
- Target size: < 250 KB each. Also export a 1200 px version for mobile (`srcset`).

---

## 4. Visual system

### 4.1 Colour (sampled from your two pieces)
```css
:root {
  --paper:      #FAF5EC;  /* warm off-white background */
  --paper-2:    #F2E8D8;  /* cards, alternate sections */
  --ink:        #2A1C12;  /* body text: dark steeped tea */
  --ink-soft:   #6B5444;  /* secondary text */
  --chai:       #A86B32;  /* primary accent: stain ring */
  --chai-light: #D4A877;  /* stain wash, borders */
  --chai-dark:  #5C3317;  /* the dark drop in the stain */
  --zest:       #F28C28;  /* orange: CTAs, highlights */
  --pulp:       #F9C846;  /* yellow: hover glow, markers */
  --juice:      #E2583E;  /* red splash: rare emphasis */
  --denim:      #2E5A6B;  /* teal from the dungarees: links, tags */
}
```
Rules: the paper and chai tones carry about 85% of the page. The illustration's saturated colours (zest, pulp, juice, denim) appear **only where something has been revealed or is interactive**. Colour itself becomes "the layer underneath". Check contrast: body text on paper ≥ 4.5:1, and never use `--pulp` for text.

### 4.2 Type (Google Fonts)
- **Display:** *Fraunces* (soft, slightly wonky optical serif; use the `SOFT` and `WONK` axes) for headlines.
- **Body/UI:** *Instrument Sans* or *DM Sans*, 17–18 px base, 1.6 line height.
- **Annotations:** *Caveat* or *Reenie Beanie* for margin notes, arrows, "look closer" hints. Use sparingly, like a pencil note.
- Fluid type scale with `clamp()`; H1 ≈ 44 → 88 px.

### 4.3 Texture & motifs
- Faint paper grain across the whole site (single tiny tiled noise PNG or SVG filter, opacity ≈ 0.06).
- **Stain rings** as section dividers and hover states (reuse cropped bits of your stain artwork).
- Hand-drawn arrows and circles (SVG, animated with `stroke-dashoffset` when scrolled into view) pointing at details in case studies.
- Generous whitespace. Let the artwork breathe like it does on your canvases.

---

## 5. Interaction catalogue (everything beyond the hero)

Keep it intentional: each interaction should express **"there's a layer underneath"**.

| # | Where | Interaction |
|---|---|---|
| 1 | Global | **Custom cursor**: small tea-coloured dot that grows into a ring labelled "peek" over revealable things and "open" over links. Disabled on touch and reduced motion. |
| 2 | Work cards | **Layer peek**: card shows the final piece. On hover, the *same mask component* as the hero reveals the sketch/process layer underneath (pencil rough, moodboard, grid). Mobile: tap-and-hold or a small "flip layer" toggle. |
| 3 | Section titles | Words "steep in": letters fade from `--chai-light` to `--ink` with a slight blur → sharp, staggered, as they enter the viewport. |
| 4 | Page transitions | A chai stain **spreads** from the clicked point to cover the screen, then recedes to reveal the new page (View Transitions API with a CSS fallback; ≤ 700 ms). |
| 5 | Case studies | **Scroll-peel layers**: see §6. |
| 6 | Field notes | Annotations draw themselves onto a brand image as you scroll; hovering an annotation highlights that region. |
| 7 | Footer | A tiny teacup; clicking it "spills" and a new random stain appears behind the footer text. An easter egg. |
| 8 | 404 | Interactive spilled cup; dragging reveals the message "This page didn't steep." |

**Build the reveal mask once as a reusable component** (`<RevealLayer top=… bottom=… brush=… resteep=…>`) and use it for #2, #8 and the hero.

---

## 6. Case study template: "Layers"

Every project page follows the same layered structure, so the story concept runs through the whole portfolio:

1. **Surface:** hero image of the final work + one-line summary, role, timeline, tools, team.
2. **Layer 1, The brief:** what was asked, who it was for, constraints.
3. **Layer 2, What I noticed:** the insight / hidden story you found (your differentiator; make it prominent, set in a large pull quote).
4. **Layer 3, The making:** sketches, explorations, rejected routes, moodboards. Use the layer-peek interaction here: final on top, process underneath.
5. **Layer 4, The system:** logo, colour, type, applications, mockups.
6. **The story it tells now:** outcome, reception, what you'd do next.
7. **Next project →** (with a peek preview).

Visual device: a slim **layer indicator** at the left edge (`Surface · Brief · Noticed · Making · System · Story`) that fills in with tea colour as you scroll. On desktop, consider sticky sections that **stack like sheets of paper** (each new section slides up over the previous one with a soft shadow).

Write case studies as Markdown/MDX files so adding a project = adding one file + images.

---

## 7. "Field Notes": prove you see the stories

A small section where you **deconstruct existing brands/designs** in 150–300 words with an annotated image (e.g. "The hidden chai-stall in a tea brand's logo", "Why this packaging feels like Sunday morning"). It turns your line "I look at designs enough to see the stories" into evidence, and it gives recruiters something memorable to talk about.

- Landing page shows 3 latest notes as cards.
- Each note: image + draggable/scroll-drawn annotations + short text.
- Start with 3 notes at launch; this section can grow over time.

---

## 8. Tech stack & project structure

**Recommended:** [Astro](https://astro.build) + TypeScript + plain CSS (custom properties), with **GSAP + ScrollTrigger** for scroll choreography. Astro ships near-zero JS by default (fast), content collections make case studies simple Markdown, and the interactive bits are small islands.

```
/
├─ BRIEF.md                    ← this file
├─ CLAUDE.md                   ← short instructions for Claude Code
├─ assets/hero/                ← source artwork (stain + illustration)
├─ public/                     ← favicons, résumé PDF, OG image, fonts if self-hosted
└─ src/
   ├─ components/
   │  ├─ RevealLayer.ts        ← reusable canvas mask engine (hero, cards, 404)
   │  ├─ Hero.astro
   │  ├─ Cursor.ts
   │  ├─ WorkCard.astro
   │  ├─ LayerIndicator.astro
   │  ├─ Annotation.astro
   │  └─ StainTransition.ts
   ├─ content/
   │  ├─ work/*.mdx            ← case studies
   │  └─ notes/*.mdx           ← field notes
   ├─ layouts/  (Base, CaseStudy, Note)
   ├─ pages/    (index, work/, work/[slug], notes/, notes/[slug], about, 404)
   └─ styles/   (tokens.css, global.css, type.css)
```

- **Hosting:** Vercel or Netlify (free tier) connected to this GitHub repo; custom domain later.
- **Analytics (optional):** Plausible or Vercel Analytics. Track a custom event `hero_revealed` to see whether people find the interaction.
- **SEO:** proper titles/descriptions per page, Open Graph image showing the half-revealed stain, `sitemap.xml`, semantic HTML.

---

## 9. Quality bars

- **Performance:** Lighthouse ≥ 90 on mobile; LCP < 2.5 s; hero images preloaded; the canvas loop idles when nothing changes; total JS on the landing page < 80 KB gzipped.
- **Accessibility:** WCAG 2.2 AA; full keyboard navigation with visible focus rings (tea-coloured); every interaction has a non-pointer alternative; `prefers-reduced-motion` respected everywhere; alt text on all work images.
- **Responsive:** 360 px → 1920 px+. Test the hero on a phone, a trackpad, and a mouse.
- **Browsers:** latest Chrome, Safari (incl. iOS), Firefox, Edge.

---

## 10. Build phases (with prompts to give Claude Code)

Run one phase at a time. Review in the browser before continuing.

**Phase 1: Foundation**
> "Read BRIEF.md. Scaffold the Astro + TypeScript project with the folder structure in §8, design tokens from §4.1, fonts from §4.2, the paper texture, and a base layout with header/footer nav. Add placeholder pages for every route in §2."
- ✅ Site runs locally, all routes load, tokens and fonts applied, mobile nav works.

**Phase 2: The hero reveal**
> "Build `RevealLayer.ts` and the landing hero exactly as specified in §3 (mask, organic edge, re-steep, 40% payoff, touch, auto-stir, keyboard button, reduced motion, no-JS fallback) using the images in `assets/hero/`."
- ✅ Smooth at 60 fps on a mid laptop; registration stays aligned when resizing; works with touch; reduced motion and keyboard paths verified.

**Phase 3: Landing page sections**
> "Build the rest of the landing page: intro, selected work (3–4 cards using the layer-peek interaction from §5 #2), field notes teaser, contact. Add the custom cursor and steep-in section titles."
- ✅ Every section is readable without interactions; cursor disabled on touch.

**Phase 4: Work & case studies**
> "Set up the `work` content collection and the case study layout from §6 with the layer indicator and stacked sections. Create one complete sample case study with placeholder content clearly marked TODO."
- ✅ Adding a new `.mdx` file creates a new project page and card automatically.

**Phase 5: Notes, About, 404**
> "Build Field Notes (§7) with the annotation component, the About page, and the interactive 404."

**Phase 6: Transitions & polish**
> "Add the stain page transition (§5 #4), footer easter egg, OG image, SEO metadata, and run a Lighthouse + accessibility pass, fixing everything below the §9 bars."

**Phase 7: Launch**
> "Prepare for deployment on Vercel/Netlify, add a README explaining how to add a new project or note."

---

## 11. Content checklist (what you need to prepare)

- [ ] Final hero art: stain + illustration on the **same artboard**, transparent backgrounds (§3.4)
- [ ] Your name, role title, one-sentence positioning statement
- [ ] 4–6 projects, each with: final images, **process images** (sketches/roughs, needed for the layer-peek), the brief, your insight, outcome
- [ ] 3 Field Notes ideas (brands whose hidden stories you've noticed)
- [ ] About text + a photo (maybe one with chai ☕)
- [ ] Résumé PDF
- [ ] Contact email + social links
- [ ] Optional: a few extra stain scans (rings, drips) to use as dividers and transitions

---

## 12. Open questions

1. Final site name / wordmark: "Steeped", your name, or something else?
2. Is the main audience full-time roles, freelance clients, or both? (Changes CTA wording.)
3. Which 4–6 projects go in, and in what order?
4. Should the microcopy (hero note, 404, footer) include any phrases in another language you speak, for personality?
5. Domain name?
