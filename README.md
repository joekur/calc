# calc

Web-based calculator notepad: https://joekur.github.io/calc/

## Documentation

### Unit conversions

Convert values with `in` (also supports `to`, `as`, `into`):

- `100 cm in m`
- `0 c in f`
- `1 gal in l`

Unit literals come after numbers:

- Length: `m`, `cm`, `mm`, `km`, `inch`/`inches`, `ft`/`feet`, `yd`, `mi`
- Area: `sq`/`square` prefix (e.g. `20 sq cm`), power suffix (e.g. `6 m2`), plus `acre`, `hectare`, `are`
- Volume: `l`/`liter`, `ml`, `gal`, `qt`, `pt`, `cup`, `tbsp`, `tsp`
- Temperature: `c`/`celsius`, `f`/`fahrenheit`, `k`/`kelvin`

Notes:

- `+`/`-` auto-convert compatible units: `1 m + 20 cm`.
- Inches are written as `inch` / `inches` (since `in` is reserved for conversion).

## Development

Install deps:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Format code (Prettier):

```bash
npm run format
```
