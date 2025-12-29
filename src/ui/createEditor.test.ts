import { afterEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { Locator } from 'vitest/browser'
import { createEditor } from './createEditor'

function dispatchMouseMove(target: Element, init: MouseEventInit) {
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...init }))
}

function dispatchMouseLeave(target: Element) {
  target.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
}

function getGutterLineValues(gutter: Element): string[] {
  return Array.from(gutter.querySelectorAll<HTMLElement>('.gutterLine')).map((line) =>
    (line.textContent ?? '').replace(/\u200b/g, '').trim()
  )
}

function mountEditor(): Locator {
  document.querySelectorAll('[data-testid="editor"]').forEach((node) => node.remove())
  const editor = createEditor()
  document.body.append(editor)
  return page.getByTestId('editor')
}

function getInput(editor: Locator): Locator {
  return editor.getByRole('textbox', { name: 'Editor' })
}

function getMirror(editor: Locator): Locator {
  return editor.getByTestId('editor-mirror')
}

function getGutter(editor: Locator): Locator {
  return editor.getByRole('region', { name: 'Results' })
}

function getTooltip(editor: Locator): Locator {
  return editor.getByRole('tooltip', { includeHidden: true })
}

function getSurface(editor: Locator): Locator {
  return editor.getByTestId('editor-surface')
}

const defaultViewport = { width: window.innerWidth, height: window.innerHeight }

test('mirrors textarea input', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor)

  await userEvent.fill(input, 'hello\nworld')

  expect(mirror.element().textContent).toContain('hello')
  expect(mirror.element().textContent).toContain('world')
})

test('highlights full-line # comments', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, '# comment\n2 + 2')

  const comment = mirror.querySelector('.tok-comment')
  expect(comment).not.toBeNull()
  expect(comment).toHaveTextContent('# comment')
})

test('highlights inline # comments', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, 'foo = 2 + 2 # this is also a comment')

  const comment = mirror.querySelector('.tok-comment')
  expect(comment).not.toBeNull()
  expect(comment).toHaveTextContent('# this is also a comment')
  expect(mirror.textContent).toContain('foo = 2 + 2')
})

test('highlights variables and operators', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, 'salary = (income + 2) * 0.3')

  expect(mirror.querySelector('.tok-assignTarget')).not.toBeNull()
  expect(mirror.querySelector('.tok-variable')).not.toBeNull()
  expect(mirror.querySelector('.tok-operator')).not.toBeNull()
  expect(mirror.querySelector('.tok-paren')).not.toBeNull()
})

test('renders evaluation results in the gutter', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor).element()

  await userEvent.fill(input, '4 + 4 / 2\n# comment\n')

  expect(gutter.textContent).toContain('6')
})

test('supports total keyword for summing previous results', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor).element()

  await userEvent.fill(input, '2\n3\ntotal\n')

  expect(getGutterLineValues(gutter)).toEqual(['2', '3', '5', ''])
})

test('total ignores errored lines and does not count itself', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor).element()

  await userEvent.fill(input, '1 +\n2\ntotal\ntotal\n')

  expect(getGutterLineValues(gutter)).toEqual(['', '2', '2', '2', ''])
})

test('total resets after empty lines but not after comments', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor).element()

  await userEvent.fill(input, '2\n# note\n3\ntotal\n\n4\ntotal\n')

  expect(getGutterLineValues(gutter)).toEqual(['2', '', '3', '5', '', '4', '4', ''])
})

test('total can be used in expressions and assignments', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor).element()

  await userEvent.fill(input, '2\n3\ngrand = total * 2\n')

  expect(getGutterLineValues(gutter)).toEqual(['2', '3', '10', ''])
})

test('clicking a gutter value copies it', async () => {
  const clipboardWriteSpy = vi.spyOn(navigator.clipboard, 'writeText')

  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor)

  await userEvent.fill(input, '2 + 2\n')

  const copyButton = gutter.getByRole('button', { name: '4' })
  expect(copyButton).toBeVisible()

  await userEvent.click(copyButton)

  await editor.click()

  await vi.waitFor(async () => {
    expect(clipboardWriteSpy).toHaveBeenCalledWith('4')
  })
})

test('keeps showing last valid value while typing errors', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const gutter = getGutter(editor).element()

  await userEvent.fill(input, '1 + 1')
  expect(gutter.textContent).toContain('2')

  await userEvent.fill(input, '1 +')
  expect(gutter.textContent).toContain('2')
})

test('defers error underline until leaving the line', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, '1 +')
  expect(mirror.querySelector('.tok-error')).toBeNull()

  // Adding a newline moves the caret to the next line.
  await userEvent.fill(input, '1 +\n')
  expect(mirror.querySelector('.tok-error')).not.toBeNull()
})

// See TODO in createEditor.ts:
test('shows error underline on blur for active line', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, '1 +')
  expect(mirror.querySelector('.tok-error')).toBeNull()

  input.element().blur()
  expect(mirror.querySelector('.tok-error')).not.toBeNull()
})

test('shows pasted errors for non-active lines', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  // The trailing newline ensures the caret is on the next line.
  await userEvent.fill(input, '1 +\n2 + 2\n')

  expect(mirror.querySelector('.tok-error')).not.toBeNull()
})

test('shows error tooltip with a delay on hover', async () => {
  vi.useFakeTimers()

  const editor = mountEditor()

  // createEditor schedules a best-effort sync on rAF; flush it.
  vi.advanceTimersByTime(20)

  const input = getInput(editor)
  const surface = getSurface(editor).element()
  const mirror = getMirror(editor).element()
  const tooltip = getTooltip(editor).element()

  await userEvent.fill(input, '1 +\n2 + 2\n')

  const lines = Array.from(mirror.querySelectorAll<HTMLElement>('.mirrorLine'))
  expect(lines.length).toBeGreaterThanOrEqual(2)
  if (lines.length < 2) return

  const errorSpan = lines[0].querySelector<HTMLElement>('.tok-code.tok-error')
  expect(errorSpan).not.toBeNull()
  if (!errorSpan) return

  surface.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  lines[0].getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  lines[1].getBoundingClientRect = () =>
    ({
      left: 0,
      top: 20,
      right: 200,
      bottom: 40,
      width: 200,
      height: 20,
      x: 0,
      y: 20,
      toJSON: () => {}
    }) as DOMRect
  errorSpan.getBoundingClientRect = () =>
    ({
      left: 50,
      top: 100,
      right: 250,
      bottom: 120,
      width: 200,
      height: 20,
      x: 50,
      y: 100,
      toJSON: () => {}
    }) as DOMRect
  tooltip.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect

  dispatchMouseMove(input.element(), { clientX: 10, clientY: 10 })
  expect(tooltip.style.display).toBe('none')

  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('block')
  expect(tooltip.textContent?.length).toBeGreaterThan(0)
  expect(tooltip.style.top).toBe('128px')
  expect(tooltip.style.left).toBe('50px')

  dispatchMouseLeave(input.element())
  expect(tooltip.style.display).toBe('block')
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('none')

  vi.useRealTimers()
})

test('positions tooltip above when there is no space below', async () => {
  vi.useFakeTimers()

  const editor = mountEditor()

  // createEditor schedules a best-effort sync on rAF; flush it.
  vi.advanceTimersByTime(20)

  const input = getInput(editor)
  const surface = getSurface(editor).element()
  const mirror = getMirror(editor).element()
  const tooltip = getTooltip(editor).element()

  await userEvent.fill(input, '1 +\n2 + 2\n')

  const lines = Array.from(mirror.querySelectorAll<HTMLElement>('.mirrorLine'))
  expect(lines.length).toBeGreaterThanOrEqual(1)
  if (lines.length < 1) return

  const errorSpan = lines[0].querySelector<HTMLElement>('.tok-code.tok-error')
  expect(errorSpan).not.toBeNull()
  if (!errorSpan) return

  surface.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 500,
      bottom: 100,
      width: 500,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  lines[0].getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  errorSpan.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 60,
      right: 210,
      bottom: 80,
      width: 200,
      height: 20,
      x: 10,
      y: 60,
      toJSON: () => {}
    }) as DOMRect
  tooltip.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect

  dispatchMouseMove(input.element(), { clientX: 10, clientY: 10 })
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('block')
  expect(tooltip.style.top).toBe('12px')

  vi.useRealTimers()
})

test('shows active line error underline after 2s idle', async () => {
  vi.useFakeTimers()

  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, '1 +')
  expect(mirror.querySelector('.tok-error')).toBeNull()

  vi.advanceTimersByTime(2000)
  expect(mirror.querySelector('.tok-error')).not.toBeNull()

  vi.useRealTimers()
})

test('keeps error underline visible when refocusing an errored line', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, '1 +\n\n')

  expect(mirror.querySelector('.tok-error')).not.toBeNull()

  // Move the caret back to the errored line.
  await userEvent.keyboard('{ArrowUp}{ArrowUp}')

  expect(mirror.querySelector('.tok-error')).not.toBeNull()
})

test('hides error tooltip after mouseleave delay', async () => {
  vi.useFakeTimers()

  const editor = mountEditor()
  const input = getInput(editor)
  const surface = getSurface(editor).element()
  const mirror = getMirror(editor).element()
  const tooltip = getTooltip(editor).element()

  await userEvent.fill(input, '1 +\n2 + 2\n')

  const lines = Array.from(mirror.querySelectorAll<HTMLElement>('.mirrorLine'))
  expect(lines.length).toBeGreaterThanOrEqual(2)
  if (lines.length < 2) return

  const errorSpan = lines[0].querySelector<HTMLElement>('.tok-code.tok-error')
  expect(errorSpan).not.toBeNull()
  if (!errorSpan) return

  surface.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  lines[0].getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  lines[1].getBoundingClientRect = () =>
    ({
      left: 0,
      top: 20,
      right: 200,
      bottom: 40,
      width: 200,
      height: 20,
      x: 0,
      y: 20,
      toJSON: () => {}
    }) as DOMRect
  errorSpan.getBoundingClientRect = () =>
    ({
      left: 50,
      top: 100,
      right: 250,
      bottom: 120,
      width: 200,
      height: 20,
      x: 50,
      y: 100,
      toJSON: () => {}
    }) as DOMRect
  tooltip.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect

  dispatchMouseMove(input.element(), { clientX: 10, clientY: 10 })
  vi.advanceTimersByTime(300)

  expect(tooltip.style.display).toBe('block')
  expect(tooltip.textContent?.length).toBeGreaterThan(0)

  dispatchMouseLeave(input.element())
  expect(tooltip.style.display).toBe('block')
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('none')

  vi.useRealTimers()
})

test('shows error tooltip on active line after idle reveal', async () => {
  vi.useFakeTimers()

  const editor = mountEditor()
  const input = getInput(editor)
  const surface = getSurface(editor).element()
  const mirror = getMirror(editor).element()
  const tooltip = getTooltip(editor).element()

  await userEvent.fill(input, '1 +')

  vi.advanceTimersByTime(2000)

  const lines = Array.from(mirror.querySelectorAll<HTMLElement>('.mirrorLine'))
  expect(lines.length).toBeGreaterThanOrEqual(1)
  if (lines.length < 1) return

  const errorSpan = lines[0].querySelector<HTMLElement>('.tok-code.tok-error')
  expect(errorSpan).not.toBeNull()
  if (!errorSpan) return

  surface.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  lines[0].getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect
  errorSpan.getBoundingClientRect = () =>
    ({
      left: 50,
      top: 100,
      right: 250,
      bottom: 120,
      width: 200,
      height: 20,
      x: 50,
      y: 100,
      toJSON: () => {}
    }) as DOMRect
  tooltip.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => {}
    }) as DOMRect

  dispatchMouseMove(input.element(), { clientX: 10, clientY: 10 })
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('block')

  vi.useRealTimers()
})

test('breaking a definition shows errors in dependent lines', async () => {
  const editor = mountEditor()
  const input = getInput(editor)
  const mirror = getMirror(editor).element()

  await userEvent.fill(input, 'foo = 1\nfoo + 1\n')
  expect(mirror.querySelectorAll('.tok-code.tok-error').length).toBe(0)

  // Break the definition; since the caret ends on a later line, the error should
  // be shown both on the definition and on dependent usages.
  await userEvent.fill(input, 'foo =\nfoo + 1\n')

  const errored = mirror.querySelectorAll('.tok-code.tok-error')
  expect(errored.length).toBeGreaterThanOrEqual(2)
})

describe('layout synchronization', () => {
  afterEach(async () => {
    await page.viewport(defaultViewport.width, defaultViewport.height)
  })

  test('keeps gutter line heights in sync after resizing', async () => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    await page.viewport(360, defaultViewport.height)

    const editor = mountEditor()

    // createEditor schedules a best-effort sync on rAF, and layout sync work is also rAF driven.
    await nextFrame()
    await nextFrame()

    const input = getInput(editor)
    const mirror = getMirror(editor).element()
    const gutter = getGutter(editor).element()

    const longWrappedExpression = Array.from({ length: 120 }, () => '1 + ').join('') + '1'
    await userEvent.fill(input, `${longWrappedExpression}\n2`)

    await nextFrame()
    await nextFrame()

    const mirrorLines = Array.from(mirror.querySelectorAll<HTMLElement>('.mirrorLine'))
    const gutterLines = Array.from(gutter.querySelectorAll<HTMLElement>('.gutterLine'))
    expect(mirrorLines.length).toBeGreaterThanOrEqual(2)
    expect(gutterLines.length).toBeGreaterThanOrEqual(2)

    const beforeMirrorHeight = mirrorLines[0].getBoundingClientRect().height
    const beforeGutterHeight = gutterLines[0].getBoundingClientRect().height
    const controlLineHeight = mirrorLines[1].getBoundingClientRect().height
    expect(beforeMirrorHeight).toBeGreaterThan(controlLineHeight)
    expect(beforeGutterHeight).toBeCloseTo(beforeMirrorHeight, 1)

    await page.viewport(1200, defaultViewport.height)
    window.dispatchEvent(new Event('resize'))

    await nextFrame()
    await nextFrame()

    const afterMirrorHeight = mirrorLines[0].getBoundingClientRect().height
    const afterGutterHeight = gutterLines[0].getBoundingClientRect().height
    expect(afterMirrorHeight).toBeLessThan(beforeMirrorHeight)
    expect(afterGutterHeight).toBeCloseTo(afterMirrorHeight, 1)
  })
})
