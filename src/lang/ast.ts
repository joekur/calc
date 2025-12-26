export type InlineAstNode = { type: 'code'; text: string } | { type: 'comment'; text: string }

export type LineAst = {
  type: 'line'
  nodes: InlineAstNode[]
}

export type DocumentAst = {
  lines: LineAst[]
}
