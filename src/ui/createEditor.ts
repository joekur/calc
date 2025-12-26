import type { Value } from '../lang/expr'
import { addValues, formatValue } from '../lang/expr'
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
  errorMessage: string | null
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

    if (computation.displayValue === '') {
      lineEl.textContent = '\u200b'
    } else {
      const valueEl = document.createElement('span')
      valueEl.className = 'gutterValue gutterValue-copyable'
      valueEl.dataset.copyValue = computation.displayValue
      valueEl.title = 'Click to copy'
      valueEl.textContent = computation.displayValue
      lineEl.append(valueEl)
    }

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
    const height = mirrorLines[index].getBoundingClientRect().height
    gutterLines[index].style.height = height > 0 ? `${height.toFixed(2)}px` : ''
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

  const tooltip = document.createElement('div')
  tooltip.className = 'errorTooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.style.display = 'none'

  let lastValidValues: Array<Value | null> = []
  let lastValidAssignments: Array<{ name: string; value: Value } | null> = []
  let activeLineIndex = 0
  let hasFocus = false
  let isSyncingScroll = false
  let latestComputations: LineComputation[] = []
  let mirrorLines: HTMLElement[] = []

  let revealedErrorLineIndices = new Set<number>()
  let activeLineIdleTimer: number | null = null
  let activeLineActivityVersion = 0

  const activeLineIdleDelayMs = 2000

  let tooltipLineIndex: number | null = null
  let tooltipShowTimer: number | null = null
  let tooltipHideTimer: number | null = null
  let pendingTooltip: { lineIndex: number; message: string } | null = null
  let copiedFeedbackTimer: number | null = null

  const tooltipDelayMs = 300
  const tooltipGapPx = 8
  const tooltipViewportPaddingPx = 8

  const clearTooltipTimers = () => {
    if (tooltipShowTimer != null) window.clearTimeout(tooltipShowTimer)
    if (tooltipHideTimer != null) window.clearTimeout(tooltipHideTimer)
    tooltipShowTimer = null
    tooltipHideTimer = null
  }

  const copyTextToClipboard = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const helper = document.createElement('textarea')
    helper.value = text
    helper.setAttribute('readonly', 'true')
    helper.style.position = 'fixed'
    helper.style.left = '-9999px'
    helper.style.top = '0'
    document.body.append(helper)
    helper.select()
    document.execCommand('copy')
    helper.remove()
  }

  const resetActiveLineIdleTimer = () => {
    activeLineActivityVersion++
    if (activeLineIdleTimer != null) window.clearTimeout(activeLineIdleTimer)
    activeLineIdleTimer = null
  }

  const scheduleActiveLineIdleErrorReveal = () => {
    if (!hasFocus) return

    if (revealedErrorLineIndices.has(activeLineIndex)) return

    const versionAtSchedule = ++activeLineActivityVersion
    const lineIndexAtSchedule = activeLineIndex

    if (activeLineIdleTimer != null) window.clearTimeout(activeLineIdleTimer)

    activeLineIdleTimer = window.setTimeout(() => {
      activeLineIdleTimer = null
      if (!hasFocus) return
      if (activeLineIndex !== lineIndexAtSchedule) return
      if (activeLineActivityVersion !== versionAtSchedule) return

      revealedErrorLineIndices.add(activeLineIndex)
      sync()
    }, activeLineIdleDelayMs)
  }

  const hideTooltipNow = () => {
    clearTooltipTimers()
    pendingTooltip = null
    tooltipLineIndex = null
    tooltip.style.display = 'none'
    tooltip.textContent = ''
  }

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  const getErrorAnchorRect = (lineIndex: number): DOMRect | null => {
    const lineEl = mirrorLines[lineIndex]
    if (!lineEl) return null

    const errorEl = lineEl.querySelector<HTMLElement>('.tok-code.tok-error')
    if (errorEl) return errorEl.getBoundingClientRect()

    const codeEl = lineEl.querySelector<HTMLElement>('.tok-code')
    if (codeEl) return codeEl.getBoundingClientRect()

    return lineEl.getBoundingClientRect()
  }

  const positionTooltipForLine = (lineIndex: number) => {
    const surfaceRect = surface.getBoundingClientRect()
    const anchorRect = getErrorAnchorRect(lineIndex)
    if (!anchorRect) return

    const tooltipRect = tooltip.getBoundingClientRect()

    const surfaceWidth = surfaceRect.width
    const surfaceHeight = surfaceRect.height

    const leftIdeal = anchorRect.left - surfaceRect.left
    const leftMax = Math.max(
      tooltipViewportPaddingPx,
      surfaceWidth - tooltipRect.width - tooltipViewportPaddingPx
    )
    const left = clamp(leftIdeal, tooltipViewportPaddingPx, leftMax)

    const topBelow = anchorRect.bottom - surfaceRect.top + tooltipGapPx

    const topAbove = anchorRect.top - surfaceRect.top - tooltipRect.height - tooltipGapPx
    const fitsBelow = topBelow + tooltipRect.height <= surfaceHeight - tooltipViewportPaddingPx
    const top = fitsBelow ? topBelow : topAbove

    const topMax = Math.max(
      tooltipViewportPaddingPx,
      surfaceHeight - tooltipRect.height - tooltipViewportPaddingPx
    )
    tooltip.style.left = `${left}px`
    tooltip.style.top = `${clamp(top, tooltipViewportPaddingPx, topMax)}px`
  }

  const showTooltipNow = (lineIndex: number, message: string) => {
    clearTooltipTimers()
    pendingTooltip = null
    tooltipLineIndex = lineIndex
    tooltip.textContent = message
    tooltip.style.display = 'block'
    positionTooltipForLine(lineIndex)
  }

  const scheduleTooltipShow = (lineIndex: number, message: string) => {
    if (tooltipHideTimer != null) window.clearTimeout(tooltipHideTimer)
    tooltipHideTimer = null

    pendingTooltip = { lineIndex, message }
    if (tooltipShowTimer != null) return

    tooltipShowTimer = window.setTimeout(() => {
      tooltipShowTimer = null
      if (!pendingTooltip) return
      showTooltipNow(pendingTooltip.lineIndex, pendingTooltip.message)
    }, tooltipDelayMs)
  }

  const scheduleTooltipHide = () => {
    if (tooltipShowTimer != null) window.clearTimeout(tooltipShowTimer)
    tooltipShowTimer = null
    pendingTooltip = null

    if (tooltip.style.display === 'none') return
    if (tooltipHideTimer != null) return

    tooltipHideTimer = window.setTimeout(() => {
      tooltipHideTimer = null
      hideTooltipNow()
    }, tooltipDelayMs)
  }

  const getLineIndexAtClientY = (clientY: number): number | null => {
    for (let index = 0; index < mirrorLines.length; index++) {
      const rect = mirrorLines[index].getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) return index
    }
    return null
  }

  const updateTooltipForMouse = (event: MouseEvent) => {
    const lineIndex = getLineIndexAtClientY(event.clientY)
    if (lineIndex == null) {
      scheduleTooltipHide()
      return
    }

    const computation = latestComputations[lineIndex]
    const message = computation?.errorMessage
    if (!computation?.showError || !message) {
      scheduleTooltipHide()
      return
    }

    if (tooltip.style.display !== 'none') {
      if (tooltipLineIndex !== lineIndex) {
        showTooltipNow(lineIndex, message)
        return
      }
      return
    }

    scheduleTooltipShow(lineIndex, message)
  }

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
    activeLineIndex = next
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

    revealedErrorLineIndices = new Set(
      Array.from(revealedErrorLineIndices).filter(
        (index) => index >= 0 && index < documentAst.lines.length
      )
    )

    activeLineIndex = Math.max(0, Math.min(activeLineIndex, documentAst.lines.length - 1))

    const env = new Map<string, Value>()

    let blockTotal: Value = { amount: 0, unit: 'none' }

    const computations: LineComputation[] = documentAst.lines.map((line, index) => {
      const code = getLineCode(line)
      const hasComment = line.nodes.some((node) => node.type === 'comment')
      const isEmptyLineBreak = !hasComment && code.trim() === ''
      if (isEmptyLineBreak) blockTotal = { amount: 0, unit: 'none' }

      env.set('total', blockTotal)

      const isTotalOnlyExpression = code.trim() === 'total'
      const hasEquals = code.includes('=')
      const shouldApplyAssignmentFallback =
        hasFocus && index === activeLineIndex && !revealedErrorLineIndices.has(index)

      if (!hasEquals) lastValidAssignments[index] = null

      const evaluation = evaluateLine(code, env)

      let resultKind: 'empty' | 'value' | 'error' = 'empty'
      if (evaluation.kind === 'expr') resultKind = evaluation.result.kind
      if (evaluation.kind === 'assign') resultKind = evaluation.result.kind
      if (evaluation.kind === 'error') resultKind = 'error'

      let errorMessage: string | null = null
      if (evaluation.kind === 'error') errorMessage = evaluation.error
      if (evaluation.kind === 'expr' && evaluation.result.kind === 'error') {
        errorMessage = evaluation.result.error
      }
      if (evaluation.kind === 'assign' && evaluation.result.kind === 'error') {
        errorMessage = evaluation.result.error
      }

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
          if (shouldApplyAssignmentFallback && fallback && hasEquals)
            env.set(fallback.name, fallback.value)
        }
      }

      if (evaluation.kind === 'error') {
        const fallback = lastValidAssignments[index]
        if (shouldApplyAssignmentFallback && fallback && hasEquals)
          env.set(fallback.name, fallback.value)
      }

      let valueForTotal: Value | null = null
      if (evaluation.kind === 'expr' && evaluation.result.kind === 'value') {
        valueForTotal = evaluation.result.value
      }
      if (evaluation.kind === 'assign' && evaluation.result.kind === 'value') {
        valueForTotal = evaluation.result.value
      }

      if (valueForTotal && !isTotalOnlyExpression) {
        const nextTotal = addValues(blockTotal, valueForTotal)
        if (nextTotal.kind === 'value') blockTotal = nextTotal.value
      }

      const displayValue =
        lastValidValues[index] == null ? '' : formatValue(lastValidValues[index] as Value)

      const hasError = resultKind === 'error' && code.trim() !== ''
      const showError =
        hasError && (!hasFocus || index !== activeLineIndex || revealedErrorLineIndices.has(index))

      return {
        code,
        displayValue,
        hasError,
        showError,
        errorMessage: hasError ? errorMessage : null
      }
    })

    for (let index = 0; index < computations.length; index++) {
      const computation = computations[index]

      if (!computation.hasError) {
        revealedErrorLineIndices.delete(index)
        continue
      }

      // Any error line that is currently visible becomes "revealed" and stays
      // visible even when it becomes the active line.
      if (!hasFocus || index !== activeLineIndex) {
        revealedErrorLineIndices.add(index)
      }
    }

    latestComputations = computations

    renderMirror(mirror, documentAst, computations)
    renderGutter(gutter, computations)
    syncGutterLineHeights(mirror, gutter)

    mirrorLines = Array.from(mirror.querySelectorAll<HTMLElement>('.mirrorLine'))

    if (tooltipLineIndex != null) {
      const tooltipComputation = latestComputations[tooltipLineIndex]
      if (!tooltipComputation?.showError || !tooltipComputation.errorMessage) {
        hideTooltipNow()
      } else if (tooltip.style.display !== 'none') {
        positionTooltipForLine(tooltipLineIndex)
      }
    }
  }

  input.addEventListener('input', () => {
    updateActiveLineIndex()
    resetActiveLineIdleTimer()
    scheduleActiveLineIdleErrorReveal()
    sync()
  })

  const handleCursorMove = () => {
    const previous = activeLineIndex
    updateActiveLineIndex()
    if (previous !== activeLineIndex) {
      resetActiveLineIdleTimer()
      scheduleActiveLineIdleErrorReveal()
      sync()
    }
  }

  input.addEventListener('keyup', handleCursorMove)
  input.addEventListener('mouseup', handleCursorMove)
  input.addEventListener('focus', () => {
    hasFocus = true
    updateActiveLineIndex()
    resetActiveLineIdleTimer()
    scheduleActiveLineIdleErrorReveal()
    sync()
  })
  input.addEventListener('blur', () => {
    hasFocus = false
    resetActiveLineIdleTimer()
    hideTooltipNow()
    sync()
  })
  input.addEventListener('mousemove', updateTooltipForMouse)
  input.addEventListener('mouseleave', () => {
    scheduleTooltipHide()
  })
  input.addEventListener('scroll', () => {
    if (isSyncingScroll) return
    isSyncingScroll = true
    mirror.scrollTop = input.scrollTop
    gutter.scrollTop = input.scrollTop
    isSyncingScroll = false

    hideTooltipNow()
  })

  gutter.addEventListener('scroll', () => {
    if (isSyncingScroll) return
    isSyncingScroll = true
    input.scrollTop = gutter.scrollTop
    mirror.scrollTop = gutter.scrollTop
    isSyncingScroll = false
  })

  gutter.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const valueEl = target?.closest<HTMLElement>('.gutterValue-copyable')
    if (!valueEl) return

    const value = valueEl.dataset.copyValue
    if (!value) return

    copyTextToClipboard(value).catch(() => {
      // Clipboard can fail in some contexts; keep it silent for now.
    })

    valueEl.classList.add('gutterValue-copied')
    if (copiedFeedbackTimer != null) window.clearTimeout(copiedFeedbackTimer)
    copiedFeedbackTimer = window.setTimeout(() => {
      copiedFeedbackTimer = null
      valueEl.classList.remove('gutterValue-copied')
    }, 800)
  })

  surface.append(mirror, input, tooltip)
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
