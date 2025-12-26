import { expect, test } from 'vitest'
import { evaluateExpression, formatValue } from './expr'

test('evaluates basic precedence', () => {
  expect(evaluateExpression('4 + 4 / 2')).toEqual({ kind: 'value', value: 6 })
  expect(evaluateExpression('2 * 3 + 4')).toEqual({ kind: 'value', value: 10 })
})

test('supports unary minus', () => {
  expect(evaluateExpression('-1 + 2')).toEqual({ kind: 'value', value: 1 })
})

test('reports invalid input', () => {
  const result = evaluateExpression('hello')
  expect(result.kind).toBe('error')
})

test('formats large integers without rounding drift', () => {
  expect(formatValue(100000000000)).toBe('1e11')
})

test('formats very small values in scientific notation', () => {
  expect(formatValue(0.0000000002)).toBe('2e-10')
})

test('scientific notation uses at most 7 significant digits', () => {
  const formatted = formatValue(1234567890123)
  expect(formatted).toBe('1.234568e12')
  const [mantissa] = formatted.split('e')
  const sigDigits = mantissa.replace('-', '').replace('.', '').length
  expect(sigDigits).toBeLessThanOrEqual(7)
})
