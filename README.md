# BU Hierarchy

BU Hierarchy is a local, mobile-first AHP pairwise comparison app for ranking people.

## Use

Open `index.html` through GitHub Pages or a local web server. The app stores names and comparisons in the browser only.

## Features

- Enter names quickly
- Compare pairs by selecting a strength and tapping the stronger name
- Use `Gleich` for direct ties
- See live progress and ranking scores
- Reset all data or only comparisons
- Installable PWA metadata for iPhone and iPad

## Local Checks

```powershell
node tests/ahp.test.mjs
node tools/build.mjs
```
