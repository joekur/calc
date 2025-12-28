export type UnitKind = 'none' | 'usd' | 'percent' | 'measure' | 'temperature'

export type MeasureInfo = {
  kind: 'measure'
  unit: string
  power: number
  toBase: number
  display: string
}

export type TemperatureInfo = {
  kind: 'temperature'
  unit: string
  toKelvin: (amount: number) => number
  fromKelvin: (kelvin: number) => number
  display: string
}

type UnitPrefix = { power: 2 | 3; consumed: number }

const prefixByWord: Record<string, 2 | 3> = {
  sq: 2,
  square: 2,
  cu: 3,
  cubic: 3,
  cb: 3
}

const normalizeUnitWord = (raw: string): string => {
  return raw.trim().toLowerCase()
}

const normalizeBaseUnitWord = (raw: string): string | null => {
  const word = normalizeUnitWord(raw)

  if (
    word === 'm' ||
    word === 'meter' ||
    word === 'meters' ||
    word === 'metre' ||
    word === 'metres'
  )
    return 'm'
  if (word === 'cm' || word === 'centimeter' || word === 'centimeters') return 'cm'
  if (word === 'mm' || word === 'millimeter' || word === 'millimeters') return 'mm'
  if (word === 'km' || word === 'kilometer' || word === 'kilometers') return 'km'

  if (word === 'inch' || word === 'inches') return 'inch'
  if (word === 'ft' || word === 'foot' || word === 'feet') return 'ft'
  if (word === 'yd' || word === 'yard' || word === 'yards') return 'yd'
  if (word === 'mi' || word === 'mile' || word === 'miles') return 'mi'

  if (
    word === 'l' ||
    word === 'liter' ||
    word === 'liters' ||
    word === 'litre' ||
    word === 'litres'
  )
    return 'l'
  if (word === 'ml' || word === 'milliliter' || word === 'milliliters') return 'ml'
  if (word === 'gal' || word === 'gallon' || word === 'gallons') return 'gal'
  if (word === 'qt' || word === 'quart' || word === 'quarts') return 'qt'
  if (word === 'pt' || word === 'pint' || word === 'pints') return 'pt'
  if (word === 'cup' || word === 'cups') return 'cup'
  if (word === 'tbsp' || word === 'tablespoon' || word === 'tablespoons') return 'tbsp'
  if (word === 'tsp' || word === 'teaspoon' || word === 'teaspoons') return 'tsp'

  if (word === 'hectare' || word === 'hectares') return 'hectare'
  if (word === 'acre' || word === 'acres') return 'acre'
  if (word === 'are' || word === 'ares') return 'are'

  if (word === 'k' || word === 'kelvin' || word === 'kelvins') return 'k'
  if (word === 'c' || word === 'celsius') return 'c'
  if (word === 'f' || word === 'fahrenheit') return 'f'

  return null
}

const parsePowerSuffix = (raw: string): { base: string; power: 1 | 2 | 3 } | null => {
  const match = raw.match(/^([a-z]+)([23])$/i)
  if (!match) return null
  const base = normalizeUnitWord(match[1])
  const power = Number(match[2]) as 2 | 3
  return { base, power }
}

export function parseUnitWords(words: string[]): { unit: string; consumed: number } | null {
  if (words.length === 0) return null

  const first = normalizeUnitWord(words[0])

  // Prefix form: `sq cm`, `cubic m`, etc.
  const prefixPower = prefixByWord[first]
  if (prefixPower) {
    if (words.length < 2) return null
    const baseWordRaw = words[1]
    const baseWithSuffix = parsePowerSuffix(baseWordRaw)
    if (baseWithSuffix) {
      const base = normalizeBaseUnitWord(baseWithSuffix.base)
      if (!base) return null
      if (baseWithSuffix.power !== prefixPower) return null
      return { unit: `${base}${prefixPower}`, consumed: 2 }
    }

    const base = normalizeBaseUnitWord(baseWordRaw)
    if (!base) return null
    if (base === 'hectare' || base === 'acre' || base === 'are') return null
    if (base === 'k' || base === 'c' || base === 'f') return null
    if (base === 'l' || base === 'ml' || base === 'gal' || base === 'qt' || base === 'pt')
      return null
    return { unit: `${base}${prefixPower}`, consumed: 2 }
  }

  // Suffix power form: `cm2`, `m3`.
  const withSuffix = parsePowerSuffix(first)
  if (withSuffix) {
    const base = normalizeBaseUnitWord(withSuffix.base)
    if (!base) return null
    if (base === 'k' || base === 'c' || base === 'f') return null
    if (base === 'hectare' || base === 'acre' || base === 'are') return null
    if (base === 'l' || base === 'ml' || base === 'gal' || base === 'qt' || base === 'pt')
      return null
    return { unit: `${base}${withSuffix.power}`, consumed: 1 }
  }

  const base = normalizeBaseUnitWord(first)
  if (!base) return null
  return { unit: base, consumed: 1 }
}

export function scanUnitAfterNumber(
  source: string,
  startIndex: number
): { unit: string; endIndex: number } | null {
  let index = startIndex
  while (index < source.length && (source[index] === ' ' || source[index] === '\t')) index++

  const words: string[] = []
  let wordStart = index

  const scanWord = (): string | null => {
    let end = wordStart
    while (end < source.length && /[A-Za-z0-9]/.test(source[end])) end++
    if (end === wordStart) return null
    const raw = source.slice(wordStart, end)
    wordStart = end
    return raw
  }

  const first = scanWord()
  if (!first) return null
  words.push(first)

  // Try 2-word units (prefix + unit).
  const prefixPower = prefixByWord[normalizeUnitWord(first)]
  if (prefixPower) {
    const beforeSecond = wordStart
    while (wordStart < source.length && (source[wordStart] === ' ' || source[wordStart] === '\t'))
      wordStart++
    const second = scanWord()
    if (!second) return null
    words.push(second)
    const parsed = parseUnitWords(words)
    if (!parsed) return null
    return { unit: parsed.unit, endIndex: wordStart }
  }

  const parsed = parseUnitWords(words)
  if (!parsed) return null
  return { unit: parsed.unit, endIndex: wordStart }
}

export function getUnitKind(unit: string): UnitKind {
  if (unit === 'none') return 'none'
  if (unit === 'usd') return 'usd'
  if (unit === 'percent') return 'percent'
  if (tryGetTemperatureInfo(unit)) return 'temperature'
  if (tryGetMeasureInfo(unit)) return 'measure'
  return 'measure'
}

export function tryGetTemperatureInfo(unit: string): TemperatureInfo | null {
  const key = normalizeUnitWord(unit)
  if (key === 'k') {
    return {
      kind: 'temperature',
      unit: 'k',
      toKelvin: (x) => x,
      fromKelvin: (k) => k,
      display: 'K'
    }
  }
  if (key === 'c') {
    return {
      kind: 'temperature',
      unit: 'c',
      toKelvin: (x) => x + 273.15,
      fromKelvin: (k) => k - 273.15,
      display: '°C'
    }
  }
  if (key === 'f') {
    return {
      kind: 'temperature',
      unit: 'f',
      toKelvin: (x) => (x - 32) * (5 / 9) + 273.15,
      fromKelvin: (k) => (k - 273.15) * (9 / 5) + 32,
      display: '°F'
    }
  }
  return null
}

export function tryGetMeasureInfo(unit: string): MeasureInfo | null {
  const normalized = normalizeUnitWord(unit)

  const specialArea: Record<string, number> = {
    hectare: 10000,
    are: 100,
    acre: 4046.8564224
  }

  const specialVolume: Record<string, number> = {
    l: 0.001,
    ml: 0.000001,
    gal: 0.003785411784,
    qt: 0.000946352946,
    pt: 0.000473176473,
    cup: 0.0002365882365,
    tbsp: 0.00001478676478125,
    tsp: 0.00000492892159375
  }

  if (normalized in specialArea) {
    return {
      kind: 'measure',
      unit: normalized,
      power: 2,
      toBase: specialArea[normalized],
      display: normalized === 'are' ? 'a' : normalized
    }
  }

  if (normalized in specialVolume) {
    const display =
      normalized === 'l'
        ? 'L'
        : normalized === 'ml'
          ? 'mL'
          : normalized === 'tbsp'
            ? 'tbsp'
            : normalized
    return {
      kind: 'measure',
      unit: normalized,
      power: 3,
      toBase: specialVolume[normalized],
      display
    }
  }

  const match = normalized.match(/^(m|cm|mm|km|inch|ft|yd|mi)([23])?$/)
  if (!match) return null

  const base = match[1]
  const power = (match[2] ? Number(match[2]) : 1) as 1 | 2 | 3

  const lengthToMeters: Record<string, number> = {
    m: 1,
    cm: 0.01,
    mm: 0.001,
    km: 1000,
    inch: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344
  }

  const toBase = Math.pow(lengthToMeters[base], power)

  const displayBase =
    base === 'inch'
      ? 'in'
      : base === 'mi'
        ? 'mi'
        : base === 'yd'
          ? 'yd'
          : base === 'ft'
            ? 'ft'
            : base
  const display = power === 1 ? displayBase : `${displayBase}^${power}`
  return { kind: 'measure', unit: normalized, power, toBase, display }
}
