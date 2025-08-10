# On Patrol: Live — Bingo+ (GitHub Pages)

Self-hosted bingo for **On Patrol: Live** with a built-in leaderboard and flexible card options.
Works entirely in the browser (localStorage), perfect for GitHub Pages.

## Highlights
- Local leaderboard: add/remove players, track wins, import/export JSON
- "Call Bingo" validates cards automatically (row/col/diag/4 corners/blackout)
- Card options: size (3×3, 4×4, 5×5), FREE center toggle, win pattern selection
- Batch print multiple cards with your chosen options
- Edit phrases, save to browser, import/export phrase lists

## Dev
```bash
npm install
npm run dev
```

## Deploy to GitHub Pages
1) Set `base` in `vite.config.js` to `'/<your-repo-name>/'`
2) Push to `main` — the included Action deploys to `gh-pages`
3) Settings → Pages → source = `gh-pages` / root

---
