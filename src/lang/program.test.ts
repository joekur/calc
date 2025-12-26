import { expect, test } from 'vitest'
import type { Value } from './expr'
import { evaluateLine } from './program'

test('evaluates assignments and later variable references', () => {
  const env = new Map<string, Value>()

  const salary = evaluateLine('salary = 43000', env)
  expect(salary.kind).toBe('assign')
  if (salary.kind !== 'assign') throw new Error('Expected assignment')
  expect(salary.result).toEqual({ kind: 'value', value: { amount: 43000, unit: 'none' } })

  const budget = evaluateLine('budget = salary * 0.3', env)
  expect(budget.kind).toBe('assign')
  if (budget.kind !== 'assign') throw new Error('Expected assignment')
  expect(budget.result.kind).toBe('value')
  if (budget.result.kind === 'value') expect(budget.result.value.amount).toBeCloseTo(12900)
})

test('supports dollar variables and unit promotion in addition', () => {
  const env = new Map<string, Value>()

  const foo = evaluateLine('foo = $100.50', env)
  expect(foo.kind).toBe('assign')
  if (foo.kind !== 'assign') throw new Error('Expected assignment')
  expect(foo.result).toEqual({ kind: 'value', value: { amount: 100.5, unit: 'usd' } })

  const expr = evaluateLine('foo * 2 + 3', env)
  expect(expr.kind).toBe('expr')
  if (expr.kind !== 'expr') throw new Error('Expected expression')
  expect(expr.result).toEqual({ kind: 'value', value: { amount: 204, unit: 'usd' } })
})

test('reports undefined variables', () => {
  const env = new Map<string, Value>()
  const result = evaluateLine('a + 1', env)
  expect(result.kind).toBe('expr')
  if (result.kind !== 'expr') throw new Error('Expected expression')
  expect(result.result.kind).toBe('error')
})

test('rejects invalid assignment targets', () => {
  const env = new Map<string, Value>()
  expect(evaluateLine('1a = 2', env)).toEqual({ kind: 'error', error: 'Invalid assignment target' })
})

test('rejects assigning to total reserved name', () => {
  const env = new Map<string, Value>()
  expect(evaluateLine('total = 2', env)).toEqual({
    kind: 'error',
    error: 'Cannot assign to reserved name: total'
  })
})
