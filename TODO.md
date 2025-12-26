# TODO

## Now (UX correctness)

- Error tooltips: show an error message on hover for errored lines.
- Paste error-state bug: after paste, ensure all lines compute error state immediately.
  - Rule: the active (focused) line should not _show_ the error underline, but the error state should still be computed and available for tooltips/gutter behavior.

## Next (language + output)

- Support `// comments` like this, both line and in-line
- Result formatting
  - Add thousands separators for large numbers.
  - Dollars display: always show 2 decimals (display-only rounding; keep full precision in evaluation).
- Copy to clipboard
  - Hover gutter result and click-to-copy.
- Exponent operator: support `^` with correct precedence.
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
