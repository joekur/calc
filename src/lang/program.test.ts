import { expect, test } from 'vitest'
import { evaluateLine } from './program'

test('evaluates assignments and later variable references', () => {
  const env = new Map<string, number>()

  const salary = evaluateLine('salary = 43000', env)
  expect(salary.kind).toBe('assign')
  if (salary.kind !== 'assign') throw new Error('Expected assignment')
  expect(salary.result).toEqual({ kind: 'value', value: 43000 })

  const budget = evaluateLine('budget = salary * 0.3', env)
  expect(budget.kind).toBe('assign')
  if (budget.kind !== 'assign') throw new Error('Expected assignment')
  expect(budget.result.kind).toBe('value')
  if (budget.result.kind === 'value') expect(budget.result.value).toBeCloseTo(12900)
})

test('reports undefined variables', () => {
  const env = new Map<string, number>()
  const result = evaluateLine('a + 1', env)
  expect(result.kind).toBe('expr')
  if (result.kind !== 'expr') throw new Error('Expected expression')
  expect(result.result.kind).toBe('error')
})

test('rejects invalid assignment targets', () => {
  const env = new Map<string, number>()
  expect(evaluateLine('1a = 2', env)).toEqual({ kind: 'error', error: 'Invalid assignment target' })
})
