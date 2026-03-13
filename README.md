# Pronorm Dealer Estimator

Kitchen cabinet estimator tool for Pronorm dealers. Built with React + Vite.

## Features

- **6,887 SKUs** from Pronorm 09/2025 price books
- **Y-line, X-line, and Proline** products (Classic line excluded)
- **72 Special Construction** codes with surcharges
- **10 Price Groups** (PG 0 through PG 10) with multipliers
- Multi-room project builder
- Dealer cost calculation with custom conversion factor
- PDF order export
- Search and filter by SKU, type, line, and category

## Data Sources

- Y-line / X-line Sales Manual 2026 (09/2025)
- Proline Sales Manual 2026 (09/2025)
- Living Sales Manual 2026 (09/2025)

## Development

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
```

Configured for Netlify deployment via `netlify.toml`.

## Price Book Update

To update pricing data, edit `src/data.js`. The data format is:

```
SKU<TAB>CategoryIndex<TAB>WidthCM<TAB>LineIndex<TAB>PG0,PG1,PG2,PG3,PG4,PG5,PG6,PG7,PG8,PG10
```

Line indices: 0=Y-line, 1=X-line, 2=Proline
