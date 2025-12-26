export type ParseStatementResult =
  | { kind: 'empty' }
  | { kind: 'expr'; exprSource: string }
  | { kind: 'assign'; name: string; exprSource: string }
  | { kind: 'error'; error: string }

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

export function parseStatement(source: string): ParseStatementResult {
  if (source.trim() === '') return { kind: 'empty' }

  const equalsIndex = source.indexOf('=')
  if (equalsIndex === -1) return { kind: 'expr', exprSource: source }

  const left = source.slice(0, equalsIndex).trim()
  const right = source.slice(equalsIndex + 1)

  if (!identifierPattern.test(left)) {
    return { kind: 'error', error: 'Invalid assignment target' }
  }

  if (right.trim() === '') {
    return { kind: 'error', error: 'Missing assignment expression' }
  }

  if (right.includes('=')) {
    return { kind: 'error', error: 'Unexpected trailing = in assignment' }
  }

  return { kind: 'assign', name: left, exprSource: right }
}
