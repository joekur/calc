# calc

Web-based calculator notepad: https://joekur.github.io/calc/

## Documentation

### Basics

- Arithmetic: `+`, `-`, `*`, `/`
- Exponentiation: `^`
- Parentheses: `(2 + 3) * 4`
- Unary `+`/`-`: `-2 ^ 2` → `-4` (use `(-2) ^ 2` if you mean `4`)

Results for each line are shown to the right. Click a value to copy to your clipboard.

### Variables (assignments)

Assign with `=`, to use in later expressions:

```
income = $60,000
budget = income * 0.3
```

### Comments

Use `#` for comments:

```
# This is a comment
4 + 2 # This is an inline comment
```

### `total`

`total` is a built-in function that represents the sum of previous successful results in the current block (consecutive lines without an empty line):

```
2
3
total # -> 5
```

You can also set the result to a variable:

```
$10
$15
expenses = total
```

### Units

#### Money (`$`)

```
$100.50 + $50.75
$100 * 2
```

#### Percent (`%`)

```
100 * 30%  # -> 30
200 + 30%  # -> 260
2/5 * 100% # -> 40%
```

#### Lengths

- Metric: `m`, `cm`, `mm`, `km`
- Imperial: `inch`/`inches`, `ft`/`feet`, `yd`/`yards`, `mi`/`miles`

#### Areas

- Prefix form: `sq`/`square` (e.g. `20 sq cm`)
- Suffix form: `m2`, `cm2`, `km2`, `ft2`, etc.
- Special units: `acre`, `hectare`, `are`

#### Volume

- Liter-family units: `l`/`liter`, `ml`, `gal`/`gallon`, `qt`/`quart`, `pt`/`pint`, `cup`, `tbsp`, `tsp`
- Cubic length units via prefix/suffix: `cu m`, `cubic m`, `cb m`, `m3`, `cm3`, etc.

#### Temperature

- `c`/`celsius`, `f`/`fahrenheit`, `k`/`kelvin`

#### Unit conversions

Convert values with `in` (also supports `to`, `as`, `into`):

- `100 cm in m`
- `0 c to f`
- `1 gal as l`

Notes:

- `+`/`-` auto-convert compatible units: `1 m + 20 cm`.

### Functions

Supported functions:

```
min(a, b)
max(a, b)
round(x)
ceil(x)
floor(x)
```

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
