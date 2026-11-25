# Token Radar — pre-token protocols ranked by implied value

An entry for make.fun bounty **token-radar-01** ("Build the best token launch radar").

## What it is

A program plus the web dashboard it writes. It reads a sealed DefiLlama
snapshot (`input/snapshot.json`, 2026-11-14), ranks every protocol that
**records no token** by what its launch would be worth, and hands in a static
dashboard: the board, a detail view for each protocol with its farm plan, and a
live-token comparison table.

## The model (`radar-2`, `lib/model.ts`)

Implied value is computed only from the snapshot's own figures:

```
implied = TVL × peer multiple × growth × seasoning × breadth
```

- **Peer multiple** — the median market-cap/TVL of live-token protocols in the
  same category, shrunk toward the global median (prior weight 3) and clamped
  to [0.05, 1.50]. Categories with no live peers use the global median.
- **Growth** — the 7-day TVL change clamped to [-50%, +100%], weighted 0.5.
- **Seasoning** — 0.70 + 0.30 × (1 − e^(−age/365)): tracked longer without a
  token scores nearer 1.00; unknown age scores 0.85.
- **Breadth** — 1 + 0.02 per extra chain, up to 10 extra chains (max ×1.20).

Coverage: all 40 watchlist protocols plus every other rankable pre-token
protocol below the $50M floor (183 rows: 40 watchlist + 143 early). No protocol name is ever special-cased.
Each row carries an 8-step farm plan derived from its category, chains, size
and age.

## Run it

Node 22+ (standard library only, no install):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`
and `out/dossier.json`.

## Layout

- `main.ts` — entry point: read snapshot, score, write outputs.
- `lib/model.ts` — the model, the board, the farm plans, the gate checks.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from the kit.
- `dashboard/` — the static page (no network): `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol detail view, and a filtered view.

## What this board does not say

A protocol on this board **records no token** in the snapshot — that is
DefiLlama's record, not proof it has none. Implied value is not a prediction
of whether or when a token is issued. Farm plans are not financial advice.

## License

MIT — see `LICENSE`.
