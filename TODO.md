# TODO

## Next (language + output)

- Basic math functions: `max(a,b)`, `min(a,b)`, `round(x)`, `ceil(x)`, `floor(x)`.
- Use vitest browser for createEditor tests, with real browser APIs
- Support `// comments` like this, both line and in-line
- Percent unit `%`
  - Distinct percent behavior.
  - Examples:
    - `200 + 30%` => `260` (percent-of-left-operand semantics)
    - `5/3 * 100%` => `166.666…%` (percent can be used as a unit in expressions)

## Later (units, documents, theming)

- More units + unit conversion (define conversion table and mismatch rules).
- Document persistence (likely `localStorage`).
- Multiple tabs/documents with independent calculator state.
- Solarized Light theme + theme switcher UI.

## Notes / Preferences

- UI framework preference: Solid.js (if/when introducing a framework).
