import type { EvalResult } from './expr'
import { evaluateExpression } from './expr'
import { parseStatement } from './statement'

export type LineEvaluation =
  | { kind: 'empty' }
  | { kind: 'expr'; result: EvalResult }
  | { kind: 'assign'; name: string; result: EvalResult }
  | { kind: 'error'; error: string }

export function evaluateLine(code: string, env: Map<string, number>): LineEvaluation {
  const parsed = parseStatement(code)

  if (parsed.kind === 'empty') return { kind: 'empty' }

  if (parsed.kind === 'error') return parsed

  if (parsed.kind === 'expr') {
    return { kind: 'expr', result: evaluateExpression(parsed.exprSource, env) }
  }

  const result = evaluateExpression(parsed.exprSource, env)
  if (result.kind === 'value') env.set(parsed.name, result.value)
  return { kind: 'assign', name: parsed.name, result }
}
