# TODO

## Next (language + output)

- Exponent operator: support `^` with correct precedence.
- Copy to clipboard
  - Hover gutter result and click-to-copy.
- Use vitest browser for createEditor tests, with real browser APIs
- Add independent syntax color for assignment expression variables. E.g. `foo = bar + 1` - `foo` should get a unique color
- Support `// comments` like this, both line and in-line
- Result formatting
  - Add thousands separators for large numbers.
  - Dollars display: always show 2 decimals (display-only rounding; keep full precision in evaluation).
- Percent unit `%`
  - Distinct percent behavior.
  - Examples:
    - `200 + 30%` => `260` (percent-of-left-operand semantics)
    - `5/3 * 100%` => `166.666…%` (percent can be used as a unit in expressions)
- Basic math functions: `max(a,b)`, `min(a,b)`, `round(x)`, `ceil(x)`, `floor(x)`.

## Later (units, documents, theming)

- More units + unit conversion (define conversion table and mismatch rules).
- Document persistence (likely `localStorage`).
- Multiple tabs/documents with independent calculator state.
- Solarized Light theme + theme switcher UI.

## Notes / Preferences

- UI framework preference: Solid.js (if/when introducing a framework).
