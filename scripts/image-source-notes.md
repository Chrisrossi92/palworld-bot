# Pal Image Source Notes

## Investigated source

- Repository: `https://github.com/camilledtr/palworld-icons`

## Result

This repository is not usable as a source for individual Pal images for `data/pals.json`.

Why:

- The repository README describes it as `Palworld cutout webp icons`.
- Its scope is `pal type` and `work skill` icons, not one asset per Pal species.
- The visible `pal_types` directory contains elemental icons such as:
  - `dark.webp`
  - `dragon.webp`
  - `electric.webp`
  - `fire.webp`
  - `grass.webp`
  - `ground.webp`
  - `ice.webp`
  - `neutral.webp`
  - `water.webp`
- Those files cannot be mapped to species entries like `Lamball`, `Cattiva`, or `Jetragon`.

## Impact

- No safe high-confidence filename normalization can be built from this repo for species-level `imageUrl` values.
- `data/pals.json` should not be modified from this source.

## Next best source format

Use a source that provides one stable image file per Pal species, ideally with predictable filenames or a machine-readable manifest.

Best options:

1. A species-icon repository with one file per Pal name.
2. A generated local asset pack extracted from game files, then checked into this repo under a stable path such as `assets/pals/`.
3. A curated manifest file such as:

```json
{
  "Lamball": "https://example.com/lamball.webp",
  "Cattiva": "https://example.com/cattiva.webp"
}
```

## Recommended next step

Find or build a species-level manifest first, then create `scripts/syncPalImageUrls.js` against that manifest instead of guessing from type icons.
