# Portfolio: instructions for Claude Code

- `BRIEF.md` is the source of truth for concept, design system, interactions and build phases. Read it before any work.
- Build one phase (BRIEF.md §10) at a time and meet its acceptance checks before moving on.
- Hero artwork lives in `assets/hero/` (`chai-stain.webp` on top, `illustration.webp` underneath). Both are final, transparent and aligned on the same 2000×1125 artboard, see BRIEF.md §3.4.
- Never invent biography, clients or project facts. Use clearly marked `TODO` placeholders instead.
- Respect `prefers-reduced-motion` and give every pointer interaction a keyboard/touch alternative.

## Project

- Astro + TypeScript, plain CSS with tokens in `src/styles/tokens.css`. Personal details live in `src/data/site.ts`, landing-page projects in `src/data/work.ts`.
- `npm run dev` (local server), `npm run build`, `npm run check` (types).
- The reveal mechanic is `src/scripts/RevealLayer.ts`, wrapped by `src/components/Reveal.astro`; reuse it, don't fork it.
- After changing the source hero art, run `node scripts/prepare-hero.mjs` to regenerate `public/hero/`.
