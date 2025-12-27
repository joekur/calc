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
