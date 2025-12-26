type VsCodeTokenColorSetting = {
  foreground?: string
  fontStyle?: string
}

type VsCodeTokenColor = {
  scope?: string | string[]
  settings?: VsCodeTokenColorSetting
}

type VsCodeTheme = {
  type?: 'dark' | 'light'
  colors?: Record<string, string>
  tokenColors?: VsCodeTokenColor[]
}

function stripJsonc(input: string): string {
  let output = ''
  let inString = false
  let stringQuote: '"' | "'" | null = null
  let escaped = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    const next = input[index + 1]

    if (inString) {
      output += char
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (stringQuote && char === stringQuote) {
        inString = false
        stringQuote = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringQuote = char
      output += char
      continue
    }

    // Line comments
    if (char === '/' && next === '/') {
      while (index < input.length && input[index] !== '\n') index++
      output += '\n'
      continue
    }

    // Block comments
    if (char === '/' && next === '*') {
      index += 2
      while (index < input.length) {
        if (input[index] === '*' && input[index + 1] === '/') {
          index += 1
          break
        }
        index++
      }
      continue
    }

    output += char
  }

  return output
}

function getFirstDefined(values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0)
}

function findCommentTokenForeground(theme: VsCodeTheme): string | undefined {
  const tokenColors = theme.tokenColors ?? []
  for (const tokenColor of tokenColors) {
    const scopes = tokenColor.scope
      ? Array.isArray(tokenColor.scope)
        ? tokenColor.scope
        : [tokenColor.scope]
      : []
    if (!scopes.includes('comment')) continue
    const foreground = tokenColor.settings?.foreground
    if (foreground) return foreground
  }
  return undefined
}

function findTokenForeground(theme: VsCodeTheme, wantedScopes: string[]): string | undefined {
  const tokenColors = theme.tokenColors ?? []

  const matchesWantedScope = (scope: string, wanted: string) =>
    scope === wanted || scope.startsWith(`${wanted}.`) || scope.includes(wanted)

  for (const tokenColor of tokenColors) {
    const scopes = tokenColor.scope
      ? Array.isArray(tokenColor.scope)
        ? tokenColor.scope
        : [tokenColor.scope]
      : []

    if (!scopes.some((scope) => wantedScopes.some((wanted) => matchesWantedScope(scope, wanted)))) {
      continue
    }

    const foreground = tokenColor.settings?.foreground
    if (foreground) return foreground
  }

  return undefined
}

export function applyVsCodeTheme(themeJsonc: string, root: HTMLElement = document.documentElement) {
  const parsed = JSON.parse(stripJsonc(themeJsonc)) as VsCodeTheme
  const colors = parsed.colors ?? {}

  const pageBg = getFirstDefined([
    colors['terminal.background'],
    colors['editorWidget.background'],
    colors['sideBar.background'],
    colors['editor.background']
  ])
  const surfaceBg = getFirstDefined([colors['editor.background'], pageBg])
  const textFg = getFirstDefined([colors['editor.foreground'], colors['input.foreground']])
  const border = getFirstDefined([
    colors['panel.border'],
    colors['sideBar.border'],
    colors['focusBorder'],
    colors['editorGroup.border']
  ])
  const caret = getFirstDefined([colors['editorCursor.foreground'], textFg])
  const commentFg = getFirstDefined([findCommentTokenForeground(parsed), textFg])
  const numberFg = getFirstDefined([
    findTokenForeground(parsed, ['constant.numeric', 'constant']),
    colors['terminal.ansiCyan'],
    textFg
  ])
  const variableFg = getFirstDefined([
    findTokenForeground(parsed, ['variable']),
    colors['terminal.ansiBlue'],
    textFg
  ])
  const operatorFg = getFirstDefined([
    findTokenForeground(parsed, ['keyword.operator', 'keyword']),
    colors['terminal.ansiYellow'],
    textFg
  ])
  const parenFg = getFirstDefined([
    colors['editorBracketHighlight.foreground3'],
    colors['terminal.ansiBrightBlue'],
    textFg
  ])
  const gutterFg = getFirstDefined([colors['editorLineNumber.activeForeground'], textFg])
  const gutterErrorFg = getFirstDefined([colors['errorForeground'], textFg])

  if (pageBg) root.style.setProperty('--app-page-bg', pageBg)
  if (surfaceBg) root.style.setProperty('--app-surface-bg', surfaceBg)
  if (textFg) root.style.setProperty('--app-text-fg', textFg)
  if (border) root.style.setProperty('--app-border', border)
  if (caret) root.style.setProperty('--app-caret', caret)
  if (commentFg) root.style.setProperty('--syntax-comment-fg', commentFg)
  if (numberFg) root.style.setProperty('--syntax-number-fg', numberFg)
  if (variableFg) root.style.setProperty('--syntax-variable-fg', variableFg)
  if (operatorFg) root.style.setProperty('--syntax-operator-fg', operatorFg)
  if (parenFg) root.style.setProperty('--syntax-paren-fg', parenFg)
  if (gutterFg) root.style.setProperty('--gutter-fg', gutterFg)
  if (gutterErrorFg) root.style.setProperty('--gutter-error-fg', gutterErrorFg)
}
