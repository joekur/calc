import { expect, test } from 'vitest'
import { evaluateExpression } from './expr'

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
