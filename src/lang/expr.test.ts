import { expect, test } from 'vitest'
import { evaluateExpression, formatValue } from './expr'

test('evaluates basic precedence', () => {
  expect(evaluateExpression('4 + 4 / 2')).toEqual({
    kind: 'value',
    value: { amount: 6, unit: 'none' }
  })
  expect(evaluateExpression('2 * 3 + 4')).toEqual({
    kind: 'value',
    value: { amount: 10, unit: 'none' }
  })
})

test('supports exponent operator ^', () => {
  expect(evaluateExpression('2 ^ 3')).toEqual({
    kind: 'value',
    value: { amount: 8, unit: 'none' }
  })
  expect(evaluateExpression('2 ^ 3 ^ 2')).toEqual({
    kind: 'value',
    value: { amount: 512, unit: 'none' }
  })
  expect(evaluateExpression('2 * 3 ^ 2')).toEqual({
    kind: 'value',
    value: { amount: 18, unit: 'none' }
  })
  expect(evaluateExpression('-2 ^ 2')).toEqual({
    kind: 'value',
    value: { amount: -4, unit: 'none' }
  })
  expect(evaluateExpression('(-2) ^ 2')).toEqual({
    kind: 'value',
    value: { amount: 4, unit: 'none' }
  })
})

test('supports basic math functions', () => {
  expect(evaluateExpression('max(1, 2)')).toEqual({
    kind: 'value',
    value: { amount: 2, unit: 'none' }
  })
  expect(evaluateExpression('min(1, 2)')).toEqual({
    kind: 'value',
    value: { amount: 1, unit: 'none' }
  })
  expect(evaluateExpression('round(1.6)')).toEqual({
    kind: 'value',
    value: { amount: 2, unit: 'none' }
  })
  expect(evaluateExpression('ceil(1.1)')).toEqual({
    kind: 'value',
    value: { amount: 2, unit: 'none' }
  })
  expect(evaluateExpression('floor(1.9)')).toEqual({
    kind: 'value',
    value: { amount: 1, unit: 'none' }
  })
})

test('math functions work with $ units', () => {
  expect(evaluateExpression('max($5, 7)')).toEqual({
    kind: 'value',
    value: { amount: 7, unit: 'usd' }
  })
  expect(evaluateExpression('round($1.4)')).toEqual({
    kind: 'value',
    value: { amount: 1, unit: 'usd' }
  })
})

test('reports invalid math function calls', () => {
  expect(evaluateExpression('max(1)').kind).toBe('error')
  expect(evaluateExpression('nope(1)').kind).toBe('error')
})

test('supports unary minus', () => {
  expect(evaluateExpression('-1 + 2')).toEqual({
    kind: 'value',
    value: { amount: 1, unit: 'none' }
  })
})

test('reports invalid input', () => {
  const result = evaluateExpression('hello')
  expect(result.kind).toBe('error')
})

test('formats large integers without rounding drift', () => {
  expect(formatValue({ amount: 100000000000, unit: 'none' })).toBe('1e11')
})

test('adds thousands separators for non-scientific integers', () => {
  expect(formatValue({ amount: 12345678, unit: 'none' })).toBe('12,345,678')
})

test('parses numbers with thousands separators', () => {
  expect(evaluateExpression('2,000 + 1')).toEqual({
    kind: 'value',
    value: { amount: 2001, unit: 'none' }
  })
  expect(evaluateExpression('$2,000 + $1')).toEqual({
    kind: 'value',
    value: { amount: 2001, unit: 'usd' }
  })

  expect(evaluateExpression('max(1,000, 2)')).toEqual({
    kind: 'value',
    value: { amount: 1000, unit: 'none' }
  })
})

test('formats very small values in scientific notation', () => {
  expect(formatValue({ amount: 0.0000000002, unit: 'none' })).toBe('2e-10')
})

test('scientific notation uses at most 7 significant digits', () => {
  const formatted = formatValue({ amount: 1234567890123, unit: 'none' })
  expect(formatted).toBe('1.234568e12')
  const [mantissa] = formatted.split('e')
  const sigDigits = mantissa.replace('-', '').replace('.', '').length
  expect(sigDigits).toBeLessThanOrEqual(7)
})

test('supports $ literals and unit propagation', () => {
  expect(evaluateExpression('$100')).toEqual({ kind: 'value', value: { amount: 100, unit: 'usd' } })
  expect(evaluateExpression('$100 + $50')).toEqual({
    kind: 'value',
    value: { amount: 150, unit: 'usd' }
  })
  expect(evaluateExpression('$100 * 2')).toEqual({
    kind: 'value',
    value: { amount: 200, unit: 'usd' }
  })
  expect(evaluateExpression('2 * $100')).toEqual({
    kind: 'value',
    value: { amount: 200, unit: 'usd' }
  })
  expect(evaluateExpression('$100 / $2')).toEqual({
    kind: 'value',
    value: { amount: 50, unit: 'none' }
  })
  expect(formatValue({ amount: 200, unit: 'usd' })).toBe('$200')

  expect(evaluateExpression('$1 + 2')).toEqual({ kind: 'value', value: { amount: 3, unit: 'usd' } })
  expect(evaluateExpression('$1 * $2').kind).toBe('error')
  expect(evaluateExpression('2 / $2').kind).toBe('error')
})

test('supports percent literals and percent-of-left addition semantics', () => {
  expect(evaluateExpression('200 + 30%')).toEqual({
    kind: 'value',
    value: { amount: 260, unit: 'none' }
  })
  expect(evaluateExpression('200 - 30%')).toEqual({
    kind: 'value',
    value: { amount: 140, unit: 'none' }
  })

  expect(evaluateExpression('$200 + 30%')).toEqual({
    kind: 'value',
    value: { amount: 260, unit: 'usd' }
  })
})

test('percent can be used as a unit in expressions', () => {
  const result = evaluateExpression('5/3 * 100%')
  expect(result.kind).toBe('value')
  if (result.kind !== 'value') return
  expect(result.value.unit).toBe('percent')
  expect(result.value.amount).toBeCloseTo(1.6666666666666667, 8)
  expect(formatValue(result.value)).toMatch(/%$/)
})

test('multiplying by percent scales and preserves left unit', () => {
  expect(evaluateExpression('100 * 4%')).toEqual({
    kind: 'value',
    value: { amount: 4, unit: 'none' }
  })

  expect(evaluateExpression('$100 * 4%')).toEqual({
    kind: 'value',
    value: { amount: 4, unit: 'usd' }
  })
})

test('percent times unitless stays percent', () => {
  expect(evaluateExpression('5% * 2')).toEqual({
    kind: 'value',
    value: { amount: 0.1, unit: 'percent' }
  })
  expect(formatValue({ amount: 0.1, unit: 'percent' })).toBe('10%')
})

test('parses and converts length units', () => {
  expect(evaluateExpression('1 m')).toEqual({ kind: 'value', value: { amount: 1, unit: 'm' } })
  expect(evaluateExpression('100 cm in m')).toEqual({
    kind: 'value',
    value: { amount: 1, unit: 'm' }
  })
  expect(evaluateExpression('1 m in cm')).toEqual({
    kind: 'value',
    value: { amount: 100, unit: 'cm' }
  })
})

test('adds compatible units by converting to left unit', () => {
  const sumMeters = evaluateExpression('1 m + 20 cm')
  expect(sumMeters.kind).toBe('value')
  if (sumMeters.kind !== 'value') return
  expect(sumMeters.value.unit).toBe('m')
  expect(sumMeters.value.amount).toBeCloseTo(1.2)

  const sumCm = evaluateExpression('20 cm + 1 m')
  expect(sumCm.kind).toBe('value')
  if (sumCm.kind !== 'value') return
  expect(sumCm.value.unit).toBe('cm')
  expect(sumCm.value.amount).toBeCloseTo(120)
})

test('supports area units and conversions via sq prefix and power suffix', () => {
  expect(evaluateExpression('20 sq cm')).toEqual({
    kind: 'value',
    value: { amount: 20, unit: 'cm2' }
  })

  const converted = evaluateExpression('6 m2 in cm2')
  expect(converted.kind).toBe('value')
  if (converted.kind !== 'value') return
  expect(converted.value.unit).toBe('cm2')
  expect(converted.value.amount).toBeCloseTo(60000)
})

test('supports volume units and conversions', () => {
  const ml = evaluateExpression('1 l in ml')
  expect(ml.kind).toBe('value')
  if (ml.kind !== 'value') return
  expect(ml.value.unit).toBe('ml')
  expect(ml.value.amount).toBeCloseTo(1000)
  const gallons = evaluateExpression('1 gal in l')
  expect(gallons.kind).toBe('value')
  if (gallons.kind !== 'value') return
  expect(gallons.value.unit).toBe('l')
  expect(gallons.value.amount).toBeCloseTo(3.785411784, 8)
})

test('supports temperature conversion', () => {
  expect(evaluateExpression('0 c in f')).toEqual({
    kind: 'value',
    value: { amount: 32, unit: 'f' }
  })

  const celsius = evaluateExpression('100 f in c')
  expect(celsius.kind).toBe('value')
  if (celsius.kind !== 'value') return
  expect(celsius.value.unit).toBe('c')
  expect(celsius.value.amount).toBeCloseTo(37.7777777778, 8)
})
