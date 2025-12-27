# TODO

## Next (language + output)

- Support `// comments` like this, both line and in-line
- Support exponent format eg `2e7` (20000000), as alternative for ^. `2e7` == `2 * 10^7`
- UI bug: some fractions show too long. Eg `1/3` results in `0.333333333333333`. For our current UI, we want a strict limit on 11 characters, including units and punctuation (eg `4,000%` is 6 characters)

## Later (units, documents, theming)

- More units + unit conversion (define conversion table and mismatch rules).
- Document persistence (likely `localStorage`).
- Multiple tabs/documents with independent calculator state.
- Solarized Light theme + theme switcher UI.

## Notes / Preferences

- UI framework preference: Solid.js (if/when introducing a framework).
  - Note: Does not look like vitest-browser yet has a plugin for solid.js. We could also consider switching to vanilla playwright since we don't need a lot of component isolated tests.
