import { formatValue } from '../lang/expr'
import { tokenizeForHighlight } from '../lang/highlight'
import { evaluateLine } from '../lang/program'
import { parseDocument } from '../lang/parse'

type CreateEditorOptions = {
  initialValue?: string
  autofocus?: boolean
}

type LineComputation = {
  code: string
  displayValue: string
  hasError: boolean
  showError: boolean
}

function getLineCode(line: ReturnType<typeof parseDocument>['lines'][number]): string {
  return line.nodes
    .filter((node) => node.type === 'code')
    .map((node) => node.text)
    .join('')
}

function renderMirror(
  mirror: HTMLElement,
  documentAst: ReturnType<typeof parseDocument>,
  computations: LineComputation[]
) {
  mirror.replaceChildren()

  const fragment = document.createDocumentFragment()

  for (let index = 0; index < documentAst.lines.length; index++) {
    const line = documentAst.lines[index]
    const lineEl = document.createElement('div')
    lineEl.className = 'mirrorLine'

    let hasAnyText = false
    for (const node of line.nodes) {
      if (node.type === 'comment') {
        const span = document.createElement('span')
        span.className = 'tok-comment'
        if (node.text !== '') hasAnyText = true
        span.textContent = node.text
        lineEl.append(span)
        continue
      }

      const codeSpan = document.createElement('span')
      codeSpan.className = 'tok-code'
      if (computations[index]?.showError) codeSpan.classList.add('tok-error')

      for (const token of tokenizeForHighlight(node.text)) {
        const tokenEl = document.createElement('span')
        if (token.type === 'ident') tokenEl.className = 'tok-variable'
        if (token.type === 'number') tokenEl.className = 'tok-number'
        if (token.type === 'operator') tokenEl.className = 'tok-operator'
        if (token.type === 'paren') tokenEl.className = 'tok-paren'
        tokenEl.textContent = token.text
        if (token.text !== '') hasAnyText = true
        codeSpan.append(tokenEl)
      }

      lineEl.append(codeSpan)
    }

    if (!hasAnyText) lineEl.textContent = '\u200b'
    fragment.append(lineEl)
  }

  mirror.append(fragment)
}

function renderGutter(gutter: HTMLElement, computations: LineComputation[]) {
  gutter.replaceChildren()

  const fragment = document.createDocumentFragment()
  for (const computation of computations) {
    const lineEl = document.createElement('div')
    lineEl.className = 'gutterLine'
    lineEl.textContent = computation.displayValue === '' ? '\u200b' : computation.displayValue
    fragment.append(lineEl)
  }

  gutter.append(fragment)
}

function syncGutterLineHeights(mirror: HTMLElement, gutter: HTMLElement) {
  if (!mirror.isConnected) return

  const mirrorLines = mirror.querySelectorAll<HTMLElement>('.mirrorLine')
  const gutterLines = gutter.querySelectorAll<HTMLElement>('.gutterLine')
  const count = Math.min(mirrorLines.length, gutterLines.length)

  for (let index = 0; index < count; index++) {
    const height = mirrorLines[index].offsetHeight
    if (height > 0) gutterLines[index].style.minHeight = `${height}px`
  }
}

export function createEditor(options: CreateEditorOptions = {}): HTMLElement {
  const editor = document.createElement('div')
  editor.className = 'editor'

  const surface = document.createElement('div')
  surface.className = 'surface'

  const mirror = document.createElement('div')
  mirror.className = 'mirror'
  mirror.setAttribute('aria-hidden', 'true')

  const input = document.createElement('textarea')
  input.className = 'input'
  input.spellcheck = false
  input.autocapitalize = 'off'
  input.autocomplete = 'off'
  input.wrap = 'soft'
  input.value = options.initialValue ?? ''
  input.setAttribute('aria-label', 'Editor')

  const gutter = document.createElement('div')
  gutter.className = 'gutter'
  gutter.setAttribute('aria-hidden', 'true')

  let lastValidValues: Array<number | null> = []
  let lastValidAssignments: Array<{ name: string; value: number } | null> = []
  let committedLineIndices = new Set<number>()
  let activeLineIndex = 0
  let isSyncingScroll = false

  const getCaretLineIndex = (): number => {
    const caret = input.selectionStart ?? 0
    let lineIndex = 0
    for (let index = 0; index < caret && index < input.value.length; index++) {
      if (input.value[index] === '\n') lineIndex++
    }
    return lineIndex
  }

  const updateActiveLineIndex = () => {
    const next = getCaretLineIndex()
    if (next !== activeLineIndex) {
      committedLineIndices.add(activeLineIndex)
      activeLineIndex = next
    }
  }

  const commitActiveLine = () => {
    committedLineIndices.add(activeLineIndex)
  }

  const sync = () => {
    const documentAst = parseDocument(input.value)

    if (lastValidValues.length !== documentAst.lines.length) {
      lastValidValues = Array.from({ length: documentAst.lines.length }, (_, index) =>
        index < lastValidValues.length ? lastValidValues[index] : null
      )
    }

    if (lastValidAssignments.length !== documentAst.lines.length) {
      lastValidAssignments = Array.from({ length: documentAst.lines.length }, (_, index) =>
        index < lastValidAssignments.length ? lastValidAssignments[index] : null
      )
    }

    committedLineIndices = new Set(
      Array.from(committedLineIndices).filter(
        (index) => index >= 0 && index < documentAst.lines.length
      )
    )
    activeLineIndex = Math.max(0, Math.min(activeLineIndex, documentAst.lines.length - 1))

    const env = new Map<string, number>()

    const computations: LineComputation[] = documentAst.lines.map((line, index) => {
      const code = getLineCode(line)
      const hasEquals = code.includes('=')

      if (!hasEquals) lastValidAssignments[index] = null

      const evaluation = evaluateLine(code, env)

      let resultKind: 'empty' | 'value' | 'error' = 'empty'
      if (evaluation.kind === 'expr') resultKind = evaluation.result.kind
      if (evaluation.kind === 'assign') resultKind = evaluation.result.kind
      if (evaluation.kind === 'error') resultKind = 'error'

      if (evaluation.kind === 'empty') {
        lastValidValues[index] = null
        lastValidAssignments[index] = null
      }

      if (evaluation.kind === 'expr') {
        if (evaluation.result.kind === 'value') lastValidValues[index] = evaluation.result.value
        if (evaluation.result.kind === 'empty') lastValidValues[index] = null
      }

      if (evaluation.kind === 'assign') {
        if (evaluation.result.kind === 'value') {
          lastValidValues[index] = evaluation.result.value
          lastValidAssignments[index] = { name: evaluation.name, value: evaluation.result.value }
        }

        if (evaluation.result.kind === 'error') {
          const fallback = lastValidAssignments[index]
          if (fallback && hasEquals) env.set(fallback.name, fallback.value)
        }
      }

      if (evaluation.kind === 'error') {
        const fallback = lastValidAssignments[index]
        if (fallback && hasEquals) env.set(fallback.name, fallback.value)
      }

      const displayValue =
        lastValidValues[index] == null ? '' : formatValue(lastValidValues[index] as number)

      const hasError = resultKind === 'error' && code.trim() !== ''
      const showError = hasError && committedLineIndices.has(index) && index !== activeLineIndex

      return { code, displayValue, hasError, showError }
    })

    renderMirror(mirror, documentAst, computations)
    renderGutter(gutter, computations)
    syncGutterLineHeights(mirror, gutter)
  }

  input.addEventListener('input', () => {
    updateActiveLineIndex()
    sync()
  })

  const handleCursorMove = () => {
    const previous = activeLineIndex
    updateActiveLineIndex()
    if (previous !== activeLineIndex) sync()
  }

  input.addEventListener('keyup', handleCursorMove)
  input.addEventListener('mouseup', handleCursorMove)
  input.addEventListener('blur', () => {
    commitActiveLine()
    sync()
  })
  input.addEventListener('scroll', () => {
    if (isSyncingScroll) return
    isSyncingScroll = true
    mirror.scrollTop = input.scrollTop
    gutter.scrollTop = input.scrollTop
    isSyncingScroll = false
  })

  gutter.addEventListener('scroll', () => {
    if (isSyncingScroll) return
    isSyncingScroll = true
    input.scrollTop = gutter.scrollTop
    mirror.scrollTop = gutter.scrollTop
    isSyncingScroll = false
  })

  surface.append(mirror, input)
  editor.append(surface, gutter)
  sync()

  // Perform a best-effort pass once connected to the DOM.
  requestAnimationFrame(() => {
    if (!editor.isConnected) return
    sync()
  })

  if (options.autofocus) {
    queueMicrotask(() => input.focus())
  }

  return editor
}
