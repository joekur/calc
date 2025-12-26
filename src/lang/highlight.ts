export type HighlightToken =
  | { type: 'whitespace'; text: string }
  | { type: 'number'; text: string }
  | { type: 'ident'; text: string }
  | { type: 'operator'; text: string }
  | { type: 'paren'; text: string }
  | { type: 'unknown'; text: string }

export function tokenizeForHighlight(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = []

  for (let index = 0; index < source.length; ) {
    const char = source[index]

    if (char === ' ' || char === '\t') {
      let end = index + 1
      while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++
      tokens.push({ type: 'whitespace', text: source.slice(index, end) })
      index = end
      continue
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1
      while (end < source.length && /[0-9.]/.test(source[end])) end++
      tokens.push({ type: 'number', text: source.slice(index, end) })
      index = end
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end++
      tokens.push({ type: 'ident', text: source.slice(index, end) })
      index = end
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', text: char })
      index++
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '=') {
      tokens.push({ type: 'operator', text: char })
      index++
      continue
    }

    tokens.push({ type: 'unknown', text: char })
    index++
  }

  return tokens
}
