type Token =
  | { type: 'number'; value: Value; raw: string }
  | { type: 'ident'; name: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' }

type Expr =
  | { type: 'number'; value: Value }
  | { type: 'ident'; name: string }
  | { type: 'unary'; op: '+' | '-'; expr: Expr }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Expr; right: Expr }

export type Unit = 'none' | 'usd'

export type Value = {
  amount: number
  unit: Unit
}

export type EvalResult =
  | { kind: 'empty' }
  | { kind: 'value'; value: Value }
  | { kind: 'error'; error: string }

function numberValue(amount: number): Value {
  return { amount, unit: 'none' }
}

function usdValue(amount: number): Value {
  return { amount, unit: 'usd' }
}

function tokenize(input: string): Token[] | EvalResult {
  const tokens: Token[] = []

  for (let index = 0; index < input.length; ) {
    const char = input[index]
    if (char === ' ' || char === '\t') {
      index++
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'lparen' })
      index++
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'rparen' })
      index++
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^') {
      tokens.push({ type: 'op', value: char })
      index++
      continue
    }

    if (char === '$') {
      const start = index
      index++
      while (index < input.length && (input[index] === ' ' || input[index] === '\t')) index++

      if (index >= input.length || !/[0-9.]/.test(input[index])) {
        return { kind: 'error', error: 'Expected number after $' }
      }

      let end = index + 1
      while (end < input.length && /[0-9.]/.test(input[end])) end++
      const rawNumber = input.slice(index, end)
      const value = Number(rawNumber)
      if (!Number.isFinite(value)) {
        return { kind: 'error', error: `Invalid number: ${rawNumber}` }
      }

      tokens.push({ type: 'number', raw: input.slice(start, end), value: usdValue(value) })
      index = end
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1
      while (end < input.length && /[A-Za-z0-9_]/.test(input[end])) end++
      tokens.push({ type: 'ident', name: input.slice(index, end) })
      index = end
      continue
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1
      while (end < input.length && /[0-9.]/.test(input[end])) end++
      const raw = input.slice(index, end)
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        return { kind: 'error', error: `Invalid number: ${raw}` }
      }
      tokens.push({ type: 'number', raw, value: numberValue(value) })
      index = end
      continue
    }

    return { kind: 'error', error: `Unexpected character: ${char}` }
  }

  return tokens
}

function parse(tokens: Token[]): Expr | EvalResult {
  let index = 0

  const current = () => tokens[index]
  const consume = () => tokens[index++]

  const peekOp = (
    ops: Array<Extract<Token, { type: 'op' }>['value']>
  ): Extract<Token, { type: 'op' }>['value'] | null => {
    const token = current()
    if (!token || token.type !== 'op') return null
    if (!ops.includes(token.value)) return null
    return token.value
  }

  const parseExpression = (): Expr | EvalResult => parseAddSub()

  const parseAddSub = (): Expr | EvalResult => {
    let left = parseMulDiv()
    if ('kind' in left) return left

    while (true) {
      const op = peekOp(['+', '-'])
      if (!op) break
      consume()
      const right = parseMulDiv()
      if ('kind' in right) return right
      left = { type: 'binary', op, left, right }
    }

    return left
  }

  const parseMulDiv = (): Expr | EvalResult => {
    let left = parseUnary()
    if ('kind' in left) return left

    while (true) {
      const op = peekOp(['*', '/'])
      if (!op) break
      consume()
      const right = parseUnary()
      if ('kind' in right) return right
      left = { type: 'binary', op, left, right }
    }

    return left
  }

  const parseUnary = (): Expr | EvalResult => {
    const token = current()
    if (token?.type === 'op' && (token.value === '+' || token.value === '-')) {
      consume()
      const expr = parseUnary()
      if ('kind' in expr) return expr
      return { type: 'unary', op: token.value, expr }
    }
    return parsePow()
  }

  // Right-associative exponentiation with higher precedence than unary.
  // Example: 2 ^ 3 ^ 2 == 2 ^ (3 ^ 2)
  // Example: -2 ^ 2 == -(2 ^ 2)
  const parsePow = (): Expr | EvalResult => {
    const left = parsePrimary()
    if ('kind' in left) return left

    const op = peekOp(['^'])
    if (!op) return left

    consume()
    const right = parsePow()
    if ('kind' in right) return right
    return { type: 'binary', op, left, right }
  }

  const parsePrimary = (): Expr | EvalResult => {
    const token = current()
    if (!token) return { kind: 'error', error: 'Unexpected end of input' }
    if (token.type === 'number') {
      consume()
      return { type: 'number', value: token.value }
    }
    if (token.type === 'ident') {
      consume()
      return { type: 'ident', name: token.name }
    }
    if (token.type === 'lparen') {
      consume()
      const expr = parseExpression()
      if ('kind' in expr) return expr
      if (current()?.type !== 'rparen') return { kind: 'error', error: 'Missing closing )' }
      consume()
      return expr
    }
    return { kind: 'error', error: `Unexpected token: ${token.type}` }
  }

  const expr = parseExpression()
  if ('kind' in expr) return expr

  if (index < tokens.length) {
    return { kind: 'error', error: 'Unexpected trailing input' }
  }
  return expr
}

function evalUnary(op: '+' | '-', value: Value): Value {
  return { amount: op === '-' ? -value.amount : value.amount, unit: value.unit }
}

function evalBinary(op: '+' | '-' | '*' | '/' | '^', left: Value, right: Value): EvalResult {
  if (op === '+' || op === '-') {
    // Promote unitless numbers to the other operand's unit.
    if (left.unit !== right.unit) {
      if (left.unit === 'none') left = { unit: right.unit, amount: left.amount }
      else if (right.unit === 'none') right = { unit: left.unit, amount: right.amount }
      else return { kind: 'error', error: 'Unit mismatch' }
    }

    return {
      kind: 'value',
      value: {
        unit: left.unit,
        amount: op === '+' ? left.amount + right.amount : left.amount - right.amount
      }
    }
  }

  if (op === '*') {
    if (left.unit !== 'none' && right.unit !== 'none') {
      return { kind: 'error', error: 'Cannot multiply two unit values' }
    }
    const unit = left.unit === 'none' ? right.unit : left.unit
    return { kind: 'value', value: { unit, amount: left.amount * right.amount } }
  }

  if (op === '/') {
    if (right.amount === 0) return { kind: 'error', error: 'Division by zero' }

    if (right.unit === 'none') {
      return { kind: 'value', value: { unit: left.unit, amount: left.amount / right.amount } }
    }

    if (left.unit === right.unit) {
      return { kind: 'value', value: { unit: 'none', amount: left.amount / right.amount } }
    }

    return { kind: 'error', error: 'Unit mismatch' }
  }

  if (op === '^') {
    if (left.unit !== 'none' || right.unit !== 'none') {
      return { kind: 'error', error: 'Cannot exponentiate unit values' }
    }

    const value = Math.pow(left.amount, right.amount)
    if (!Number.isFinite(value)) return { kind: 'error', error: 'Invalid exponentiation' }
    return { kind: 'value', value: { unit: 'none', amount: value } }
  }

  return { kind: 'error', error: 'Unknown operator' }
}

function evalExpr(expr: Expr, env: Map<string, Value>): EvalResult {
  switch (expr.type) {
    case 'number':
      return { kind: 'value', value: expr.value }
    case 'ident': {
      const value = env.get(expr.name)
      if (value == null) return { kind: 'error', error: `Undefined variable: ${expr.name}` }
      return { kind: 'value', value }
    }
    case 'unary': {
      const inner = evalExpr(expr.expr, env)
      if (inner.kind !== 'value') return inner
      return { kind: 'value', value: evalUnary(expr.op, inner.value) }
    }
    case 'binary': {
      const left = evalExpr(expr.left, env)
      if (left.kind !== 'value') return left
      const right = evalExpr(expr.right, env)
      if (right.kind !== 'value') return right

      return evalBinary(expr.op, left.value, right.value)
    }
  }
}

export function evaluateExpression(
  source: string,
  env: Map<string, Value> = new Map()
): EvalResult {
  const trimmed = source.trim()
  if (trimmed === '') return { kind: 'empty' }

  const tokensOrError = tokenize(trimmed)
  if (!Array.isArray(tokensOrError)) return tokensOrError
  const astOrError = parse(tokensOrError)
  if ('kind' in astOrError) return astOrError
  return evalExpr(astOrError, env)
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return String(value)

  if (value === 0) return '0'

  const abs = Math.abs(value)
  const scientificThreshold = 1e9
  const smallThreshold = 1e-9

  if (abs >= scientificThreshold || abs < smallThreshold) {
    const maxSignificantDigits = 7

    // Keep output short (no `+` in exponent, trim mantissa zeros).
    // `toExponential(n)` uses 1 digit before the dot and `n` after it, so this
    // caps the mantissa to at most `1 + n` significant digits.
    const [mantissaRaw, expRaw] = value.toExponential(maxSignificantDigits - 1).split('e')
    const exponent = Number.parseInt(expRaw, 10)
    const mantissa = mantissaRaw.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
    return `${mantissa}e${exponent}`
  }

  // Avoid scaling-based rounding (e.g. `value * 1e12`) which breaks for
  // larger magnitudes due to floating point precision.
  if (Number.isSafeInteger(value)) return String(value)

  // `toPrecision` gives a stable, human-friendly representation and smooths out
  // common floating point noise (e.g. 0.30000000000000004 -> 0.3).
  const text = value.toPrecision(15)

  // Trim trailing zeros for non-exponent form.
  if (!text.includes('e') && text.includes('.')) {
    return text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  }

  return text
}

export function formatValue(value: Value): string {
  const prefix = value.unit === 'usd' ? '$' : ''
  return `${prefix}${formatAmount(value.amount)}`
}
