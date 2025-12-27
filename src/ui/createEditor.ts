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
  errorMessage: string | null
}

const copyTextToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
}

function getLineCode(line: ReturnType<typeof parseDocument>['lines'][number]): string {
  return line.nodes
    .filter((node) => node.type === 'code')
    .map((node) => node.text)
    .join('')
}

type DocumentAst = ReturnType<typeof parseDocument>
type DocumentLine = DocumentAst['lines'][number]

function getMirrorLineKey(line: DocumentLine): string {
  return line.nodes.map((node) => `${node.type}:${node.text}`).join('|')
}

function renderMirrorLine(lineEl: HTMLElement, line: DocumentLine) {
  lineEl.replaceChildren()

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

    for (const token of tokenizeForHighlight(node.text)) {
      const tokenEl = document.createElement('span')
      if (token.type === 'ident') tokenEl.className = 'tok-variable'
      if (token.type === 'assignTarget') tokenEl.className = 'tok-assignTarget'
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
}

function renderGutterLine(
  lineEl: HTMLElement,
  valueEl: HTMLButtonElement | null,
  lineIndex: number,
  displayValue: string
): HTMLButtonElement | null {
  if (displayValue === '') {
    if (valueEl) valueEl.remove()
    lineEl.textContent = '\u200b'
    return null
  }

  if (!valueEl) {
    lineEl.replaceChildren()
    valueEl = document.createElement('button')
    valueEl.type = 'button'
    valueEl.className = 'gutterValue gutterValue-copyable'
    lineEl.append(valueEl)
  }

  valueEl.dataset.lineIndex = `${lineIndex}`
  valueEl.dataset.testid = `gutter-value-${lineIndex}`
  valueEl.textContent = displayValue
  return valueEl
}

function resizeArray<T>(array: Array<T | null>, nextLength: number): Array<T | null> {
  if (array.length === nextLength) return array
  return Array.from({ length: nextLength }, (_, index) =>
    index < array.length ? array[index] : null
  )
}

export function createEditor(options: CreateEditorOptions = {}): HTMLElement {
  const editor = document.createElement('div')
  editor.className = 'editor'
  editor.dataset.testid = 'editor'

  const surface = document.createElement('div')
  surface.className = 'surface'
  surface.dataset.testid = 'editor-surface'

  const mirror = document.createElement('div')
  mirror.className = 'mirror'
  mirror.setAttribute('aria-hidden', 'true')
  mirror.dataset.testid = 'editor-mirror'

  const input = document.createElement('textarea')
  input.className = 'input'
  input.dataset.testid = 'editor-input'
  input.spellcheck = false
  input.autocapitalize = 'off'
  input.autocomplete = 'off'
  input.wrap = 'soft'
  input.value = options.initialValue ?? ''
  input.setAttribute('aria-label', 'Editor')

  const gutter = document.createElement('div')
  gutter.className = 'gutter'
  gutter.setAttribute('role', 'region')
  gutter.setAttribute('aria-label', 'Results')
  gutter.dataset.testid = 'editor-gutter'

  const tooltip = document.createElement('div')
  tooltip.className = 'errorTooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.dataset.testid = 'editor-tooltip'
  tooltip.style.display = 'none'

  let lastValidValues: Array<Value | null> = []
  let lastValidAssignments: Array<{ name: string; value: Value } | null> = []
  let activeLineIndex = 0
  let hasFocus = false
  let isSyncingScroll = false
  let latestComputations: LineComputation[] = []
  let mirrorLines: HTMLElement[] = []
  let mirrorLineKeys: Array<string | null> = []
  let gutterLines: HTMLElement[] = []
  let gutterLineValues: Array<string | null> = []
  let gutterValueButtons: Array<HTMLButtonElement | null> = []

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
  let pendingScrollTop: number | null = null
  let scrollSyncFrame: number | null = null
  let pendingHeightSyncIndices = new Set<number>()
  let heightSyncFrame: number | null = null

  const ensureLineElements = (
    container: HTMLElement,
    existing: HTMLElement[],
    className: string,
    count: number
  ) => {
    while (existing.length < count) {
      const lineEl = document.createElement('div')
      lineEl.className = className
      container.append(lineEl)
      existing.push(lineEl)
    }

    while (existing.length > count) {
      const lineEl = existing.pop()
      lineEl?.remove()
    }
  }

  const scheduleHeightSyncForLine = (lineIndex: number) => {
    pendingHeightSyncIndices.add(lineIndex)
    if (heightSyncFrame != null) return

    heightSyncFrame = requestAnimationFrame(() => {
      heightSyncFrame = null
      if (!mirror.isConnected) return

      const indices = Array.from(pendingHeightSyncIndices).sort((a, b) => a - b)
      pendingHeightSyncIndices = new Set<number>()
      for (const index of indices) {
        const mirrorLine = mirrorLines[index]
        const gutterLine = gutterLines[index]
        if (!mirrorLine || !gutterLine) continue
        const height = mirrorLine.getBoundingClientRect().height
        gutterLine.style.height = height > 0 ? `${height.toFixed(2)}px` : ''
      }
    })
  }

  const scheduleHeightSyncAll = () => {
    for (let index = 0; index < mirrorLines.length; index++) scheduleHeightSyncForLine(index)
  }

  const clearTooltipTimers = () => {
    if (tooltipShowTimer != null) window.clearTimeout(tooltipShowTimer)
    if (tooltipHideTimer != null) window.clearTimeout(tooltipHideTimer)
    tooltipShowTimer = null
    tooltipHideTimer = null
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
      applyErrorDecorations()
    }, activeLineIdleDelayMs)
  }

  const hideTooltipNow = () => {
    clearTooltipTimers()
    pendingTooltip = null
    tooltipLineIndex = null
    if (tooltip.style.display === 'none') return
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
    if (!message || !shouldShowErrorForLine(lineIndex)) {
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

  const shouldShowErrorForLine = (lineIndex: number): boolean => {
    const computation = latestComputations[lineIndex]
    if (!computation?.hasError) return false
    if (!hasFocus) return true
    if (lineIndex !== activeLineIndex) return true
    return revealedErrorLineIndices.has(lineIndex)
  }

  const applyErrorDecorations = () => {
    for (let lineIndex = 0; lineIndex < mirrorLines.length; lineIndex++) {
      const lineEl = mirrorLines[lineIndex]
      const showError = shouldShowErrorForLine(lineIndex)
      const codeSpans = lineEl.querySelectorAll<HTMLElement>('.tok-code')
      for (const span of codeSpans) {
        span.classList.toggle('tok-error', showError)
      }
    }

    if (tooltipLineIndex != null) {
      const tooltipComputation = latestComputations[tooltipLineIndex]
      if (!tooltipComputation?.hasError || !tooltipComputation.errorMessage) {
        hideTooltipNow()
      } else if (tooltip.style.display !== 'none') {
        if (!shouldShowErrorForLine(tooltipLineIndex)) {
          hideTooltipNow()
        } else {
          positionTooltipForLine(tooltipLineIndex)
        }
      }
    }
  }

  const sync = () => {
    const documentAst = parseDocument(input.value)
    const lineCount = documentAst.lines.length
    const lineCountChanged = lineCount !== mirrorLines.length || lineCount !== gutterLines.length

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

      return {
        code,
        displayValue,
        hasError,
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

    ensureLineElements(mirror, mirrorLines, 'mirrorLine', lineCount)
    ensureLineElements(gutter, gutterLines, 'gutterLine', lineCount)
    mirrorLineKeys = resizeArray(mirrorLineKeys, lineCount)
    gutterLineValues = resizeArray(gutterLineValues, lineCount)
    gutterValueButtons = resizeArray(
      gutterValueButtons,
      lineCount
    ) as Array<HTMLButtonElement | null>

    if (lineCountChanged) scheduleHeightSyncAll()

    for (let index = 0; index < lineCount; index++) {
      const nextMirrorKey = getMirrorLineKey(documentAst.lines[index])
      if (mirrorLineKeys[index] !== nextMirrorKey) {
        renderMirrorLine(mirrorLines[index], documentAst.lines[index])
        mirrorLineKeys[index] = nextMirrorKey
        scheduleHeightSyncForLine(index)
      }

      const nextDisplayValue = computations[index]?.displayValue ?? ''
      if (gutterLineValues[index] !== nextDisplayValue) {
        gutterValueButtons[index] = renderGutterLine(
          gutterLines[index],
          gutterValueButtons[index],
          index,
          nextDisplayValue
        )
        gutterLineValues[index] = nextDisplayValue
      }
    }

    applyErrorDecorations()
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
      if (latestComputations[previous]?.hasError) revealedErrorLineIndices.add(previous)
      applyErrorDecorations()
    }
  }

  input.addEventListener('keyup', handleCursorMove)
  input.addEventListener('mouseup', handleCursorMove)
  input.addEventListener('focus', () => {
    hasFocus = true
    updateActiveLineIndex()
    resetActiveLineIdleTimer()
    scheduleActiveLineIdleErrorReveal()
    applyErrorDecorations()
  })
  input.addEventListener('blur', () => {
    hasFocus = false
    resetActiveLineIdleTimer()
    hideTooltipNow()
    for (let index = 0; index < latestComputations.length; index++) {
      if (latestComputations[index]?.hasError) revealedErrorLineIndices.add(index)
    }
    applyErrorDecorations()
  })
  input.addEventListener('mousemove', updateTooltipForMouse)
  input.addEventListener('mouseleave', () => {
    scheduleTooltipHide()
  })
  const scheduleScrollSync = (scrollTop: number) => {
    pendingScrollTop = scrollTop
    if (scrollSyncFrame != null) return

    scrollSyncFrame = requestAnimationFrame(() => {
      scrollSyncFrame = null
      if (pendingScrollTop == null) return
      const next = pendingScrollTop
      pendingScrollTop = null
      isSyncingScroll = true
      if (input.scrollTop !== next) input.scrollTop = next
      if (mirror.scrollTop !== next) mirror.scrollTop = next
      if (gutter.scrollTop !== next) gutter.scrollTop = next
      isSyncingScroll = false
    })
  }

  input.addEventListener(
    'scroll',
    () => {
      if (isSyncingScroll) return
      scheduleScrollSync(input.scrollTop)

      hideTooltipNow()
    },
    { passive: true }
  )

  gutter.addEventListener(
    'scroll',
    () => {
      if (isSyncingScroll) return
      scheduleScrollSync(gutter.scrollTop)
    },
    { passive: true }
  )

  gutter.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const button = target.closest<HTMLButtonElement>('button.gutterValue-copyable')
    if (!button) return
    const lineIndex = Number(button.dataset.lineIndex)
    if (!Number.isFinite(lineIndex)) return
    const displayValue = latestComputations[lineIndex]?.displayValue
    if (!displayValue) return
    console.log('Copying to clipboard:', displayValue)
    copyTextToClipboard(displayValue)
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
