import type { DocumentAst, InlineAstNode, LineAst } from './ast'

function findInlineCommentStartIndex(raw: string): number {
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] !== '#') continue
    if (index === 0) return index
    if (/\s/.test(raw[index - 1])) return index
  }
  return -1
}

export function parseLine(raw: string): LineAst {
  // Full-line comment (allow leading spaces).
  if (raw.trimStart().startsWith('#')) {
    return { type: 'line', nodes: [{ type: 'comment', text: raw }] }
  }

  const commentIndex = findInlineCommentStartIndex(raw)
  if (commentIndex === -1) {
    return { type: 'line', nodes: [{ type: 'code', text: raw }] }
  }

  const before = raw.slice(0, commentIndex)
  const after = raw.slice(commentIndex)

  const nodes: InlineAstNode[] = []
  if (before !== '') nodes.push({ type: 'code', text: before })
  nodes.push({ type: 'comment', text: after })
  return { type: 'line', nodes }
}

export function parseDocument(source: string): DocumentAst {
  return { lines: source.split('\n').map(parseLine) }
}
