// Crops the hero artwork (assets/hero, 2000×1125 shared artboard) to the area the art
// actually occupies and writes web sizes to public/hero. Run: node scripts/prepare-hero.mjs
import sharp from 'sharp';

// Union of both layers' bounding boxes, plus a little air. Both crops use the same box,
// so the stain and the illustration stay registered.
const CROP = { left: 520, top: 100, width: 960, height: 890 };
const SIZES = [960, 600];

for (const name of ['chai-stain', 'illustration']) {
  for (const width of SIZES) {
    const out = `public/hero/${name}-${width}.webp`;
    await sharp(`assets/hero/${name}.webp`)
      .extract(CROP)
      .resize({ width })
      .webp({ quality: 86, alphaQuality: 100, effort: 6 })
      .toFile(out);
    console.log('wrote', out);
  }
}
