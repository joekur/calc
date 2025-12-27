export type HighlightToken =
  | { type: 'whitespace'; text: string }
  | { type: 'number'; text: string }
  | { type: 'ident'; text: string }
  | { type: 'assignTarget'; text: string }
  | { type: 'operator'; text: string }
  | { type: 'paren'; text: string }
  | { type: 'unknown'; text: string }

function scanNumericToken(source: string, start: number): number {
  let end = start
  let seenDot = false

  while (end < source.length) {
    const char = source[end]
    if (/[0-9]/.test(char)) {
      end++
      continue
    }

    if (char === '.') {
      if (seenDot) break
      seenDot = true
      end++
      continue
    }

    if (char === ',') {
      if (seenDot) break

      const digits = source.slice(end + 1, end + 4)
      if (/^[0-9]{3}$/.test(digits)) {
        end++
        continue
      }

      break
    }

    break
  }

  return end
}

export function tokenizeForHighlight(source: string): HighlightToken[] {
  const tokens: HighlightToken[] = []

  const assignmentTargetMatch = source.match(/^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*=/)
  const assignmentTargetStart = assignmentTargetMatch
    ? assignmentTargetMatch[0].indexOf(assignmentTargetMatch[1])
    : -1
  const assignmentTargetEnd =
    assignmentTargetStart >= 0 && assignmentTargetMatch
      ? assignmentTargetStart + assignmentTargetMatch[1].length
      : -1

  for (let index = 0; index < source.length; ) {
    const char = source[index]

    if (char === ' ' || char === '\t') {
      let end = index + 1
      while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++
      tokens.push({ type: 'whitespace', text: source.slice(index, end) })
      index = end
      continue
    }

    if (char === '$') {
      let end = index + 1
      while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++
      if (end < source.length && /[0-9.]/.test(source[end])) {
        end = scanNumericToken(source, end)
        tokens.push({ type: 'number', text: source.slice(index, end) })
        index = end
        continue
      }
    }

    if (/[0-9.]/.test(char)) {
      let end = scanNumericToken(source, index)
      if (end < source.length && source[end] === '%') end++
      tokens.push({ type: 'number', text: source.slice(index, end) })
      index = end
      continue
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end++

      const type =
        assignmentTargetStart === index && assignmentTargetEnd === end ? 'assignTarget' : 'ident'
      tokens.push({ type, text: source.slice(index, end) })
      index = end
      continue
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', text: char })
      index++
      continue
    }

    if (
      char === '+' ||
      char === '-' ||
      char === '*' ||
      char === '/' ||
      char === '^' ||
      char === '=' ||
      char === ','
    ) {
      tokens.push({ type: 'operator', text: char })
      index++
      continue
    }

    tokens.push({ type: 'unknown', text: char })
    index++
  }

  return tokens
}
