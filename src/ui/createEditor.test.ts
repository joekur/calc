import { fireEvent } from '@testing-library/dom'
import { expect, test } from 'vitest'
import { vi } from 'vitest'
import { createEditor } from './createEditor'

function getGutterLineValues(gutter: HTMLElement): string[] {
  return Array.from(gutter.querySelectorAll<HTMLElement>('.gutterLine')).map((line) =>
    (line.textContent ?? '').replace(/\u200b/g, '').trim()
  )
}

test('mirrors textarea input', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  expect(input).not.toBeNull()
  expect(mirror).not.toBeNull()
  if (!input || !mirror) return

  input.value = 'hello\nworld'
  fireEvent.input(input)

  expect(mirror.textContent).toContain('hello')
  expect(mirror.textContent).toContain('world')
})

test('highlights full-line # comments', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  expect(input).not.toBeNull()
  expect(mirror).not.toBeNull()
  if (!input || !mirror) return

  input.value = '# comment\n2 + 2'
  fireEvent.input(input)

  const comment = mirror.querySelector('.tok-comment')
  expect(comment).not.toBeNull()
  expect(comment).toHaveTextContent('# comment')
})

test('highlights inline # comments', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  expect(input).not.toBeNull()
  expect(mirror).not.toBeNull()
  if (!input || !mirror) return

  input.value = 'foo = 2 + 2 # this is also a comment'
  fireEvent.input(input)

  const comment = mirror.querySelector('.tok-comment')
  expect(comment).not.toBeNull()
  expect(comment).toHaveTextContent('# this is also a comment')
  expect(mirror.textContent).toContain('foo = 2 + 2')
})

test('highlights variables and operators', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  expect(input).not.toBeNull()
  expect(mirror).not.toBeNull()
  if (!input || !mirror) return

  input.value = 'salary = (income + 2) * 0.3'
  fireEvent.input(input)

  expect(mirror.querySelector('.tok-assignTarget')).not.toBeNull()
  expect(mirror.querySelector('.tok-variable')).not.toBeNull()
  expect(mirror.querySelector('.tok-operator')).not.toBeNull()
  expect(mirror.querySelector('.tok-paren')).not.toBeNull()
})

test('renders evaluation results in the gutter', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '4 + 4 / 2\n# comment\n'
  fireEvent.input(input)

  expect(gutter.textContent).toContain('6')
})

test('supports total keyword for summing previous results', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '2\n3\ntotal\n'
  fireEvent.input(input)

  expect(getGutterLineValues(gutter)).toEqual(['2', '3', '5', ''])
})

test('total ignores errored lines and does not count itself', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '1 +\n2\ntotal\ntotal\n'
  fireEvent.input(input)

  expect(getGutterLineValues(gutter)).toEqual(['', '2', '2', '2', ''])
})

test('total resets after empty lines but not after comments', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '2\n# note\n3\ntotal\n\n4\ntotal\n'
  fireEvent.input(input)

  expect(getGutterLineValues(gutter)).toEqual(['2', '', '3', '5', '', '4', '4', ''])
})

test('total can be used in expressions and assignments', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '2\n3\ngrand = total * 2\n'
  fireEvent.input(input)

  expect(getGutterLineValues(gutter)).toEqual(['2', '3', '10', ''])
})

test('clicking a gutter value copies it', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  ;(navigator as any).clipboard = { writeText }

  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '2 + 2\n'
  fireEvent.input(input)

  const value = gutter.querySelector<HTMLElement>('.gutterValue-copyable')
  expect(value).not.toBeNull()
  if (!value) return

  fireEvent.click(value)

  await Promise.resolve()
  expect(writeText).toHaveBeenCalledWith('4')
})

test('keeps showing last valid value while typing errors', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const gutter = editor.querySelector<HTMLDivElement>('.gutter')
  expect(input).not.toBeNull()
  expect(gutter).not.toBeNull()
  if (!input || !gutter) return

  input.value = '1 + 1'
  fireEvent.input(input)
  expect(gutter.textContent).toContain('2')

  input.value = '1 +'
  fireEvent.input(input)
  expect(gutter.textContent).toContain('2')
})

test('defers error underline until leaving the line', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  expect(input).not.toBeNull()
  if (!input) return

  fireEvent.focus(input)

  input.value = '1 +'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)
  expect(editor.querySelector('.tok-error')).toBeNull()

  input.value = '1 +\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)
  expect(editor.querySelector('.tok-error')).not.toBeNull()
})

test('shows error underline on blur for active line', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  expect(input).not.toBeNull()
  if (!input) return

  fireEvent.focus(input)
  input.value = '1 +'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)
  expect(editor.querySelector('.tok-error')).toBeNull()

  fireEvent.blur(input)
  expect(editor.querySelector('.tok-error')).not.toBeNull()
})

test('shows pasted errors for non-active lines', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  expect(input).not.toBeNull()
  if (!input) return

  fireEvent.focus(input)
  input.value = '1 +\n2 + 2\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)

  expect(editor.querySelector('.tok-error')).not.toBeNull()
})

test('shows error tooltip with a delay on hover', () => {
  vi.useFakeTimers()

  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const surface = editor.querySelector<HTMLDivElement>('.surface')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  const tooltip = editor.querySelector<HTMLDivElement>('.errorTooltip')
  expect(input).not.toBeNull()
  expect(surface).not.toBeNull()
  expect(mirror).not.toBeNull()
  expect(tooltip).not.toBeNull()
  if (!input || !surface || !mirror || !tooltip) return

  fireEvent.focus(input)
  input.value = '1 +\n2 + 2\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)

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

  fireEvent.mouseMove(input, { clientX: 10, clientY: 10 })
  expect(tooltip.style.display).toBe('none')

  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('block')
  expect(tooltip.textContent?.length).toBeGreaterThan(0)
  expect(tooltip.style.top).toBe('128px')
  expect(tooltip.style.left).toBe('50px')

  fireEvent.mouseLeave(input)
  expect(tooltip.style.display).toBe('block')
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('none')

  vi.useRealTimers()
})

test('positions tooltip above when there is no space below', () => {
  vi.useFakeTimers()

  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const surface = editor.querySelector<HTMLDivElement>('.surface')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  const tooltip = editor.querySelector<HTMLDivElement>('.errorTooltip')
  expect(input).not.toBeNull()
  expect(surface).not.toBeNull()
  expect(mirror).not.toBeNull()
  expect(tooltip).not.toBeNull()
  if (!input || !surface || !mirror || !tooltip) return

  fireEvent.focus(input)
  input.value = '1 +\n2 + 2\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)

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

  fireEvent.mouseMove(input, { clientX: 10, clientY: 10 })
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('block')
  expect(tooltip.style.top).toBe('12px')

  vi.useRealTimers()
})

test('shows active line error underline after 2s idle', () => {
  vi.useFakeTimers()

  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  expect(input).not.toBeNull()
  if (!input) return

  fireEvent.focus(input)
  input.value = '1 +'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)
  expect(editor.querySelector('.tok-error')).toBeNull()

  vi.advanceTimersByTime(2000)
  expect(editor.querySelector('.tok-error')).not.toBeNull()

  vi.useRealTimers()
})

test('keeps error underline visible when refocusing an errored line', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  expect(input).not.toBeNull()
  if (!input) return

  fireEvent.focus(input)

  input.value = '1 +\n\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)

  expect(editor.querySelector('.tok-error')).not.toBeNull()

  input.selectionStart = 2
  input.selectionEnd = 2
  fireEvent.keyUp(input)

  expect(editor.querySelector('.tok-error')).not.toBeNull()
})

test('hides error tooltip after mouseleave delay', () => {
  vi.useFakeTimers()

  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const surface = editor.querySelector<HTMLDivElement>('.surface')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  const tooltip = editor.querySelector<HTMLDivElement>('.errorTooltip')
  expect(input).not.toBeNull()
  expect(surface).not.toBeNull()
  expect(mirror).not.toBeNull()
  expect(tooltip).not.toBeNull()
  if (!input || !surface || !mirror || !tooltip) return

  fireEvent.focus(input)
  input.value = '1 +\n2 + 2\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)

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

  fireEvent.mouseMove(input, { clientX: 10, clientY: 10 })
  vi.advanceTimersByTime(300)

  expect(tooltip.style.display).toBe('block')
  expect(tooltip.textContent?.length).toBeGreaterThan(0)

  fireEvent.mouseLeave(input)
  expect(tooltip.style.display).toBe('block')
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('none')

  vi.useRealTimers()
})

test('shows error tooltip on active line after idle reveal', () => {
  vi.useFakeTimers()

  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const surface = editor.querySelector<HTMLDivElement>('.surface')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  const tooltip = editor.querySelector<HTMLDivElement>('.errorTooltip')
  expect(input).not.toBeNull()
  expect(surface).not.toBeNull()
  expect(mirror).not.toBeNull()
  expect(tooltip).not.toBeNull()
  if (!input || !surface || !mirror || !tooltip) return

  fireEvent.focus(input)
  input.value = '1 +'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)

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

  fireEvent.mouseMove(input, { clientX: 10, clientY: 10 })
  vi.advanceTimersByTime(300)
  expect(tooltip.style.display).toBe('block')

  vi.useRealTimers()
})

test('breaking a definition shows errors in dependent lines', () => {
  const editor = createEditor()
  document.body.append(editor)

  const input = editor.querySelector<HTMLTextAreaElement>('textarea.input')
  const mirror = editor.querySelector<HTMLDivElement>('.mirror')
  expect(input).not.toBeNull()
  expect(mirror).not.toBeNull()
  if (!input || !mirror) return

  fireEvent.focus(input)

  input.value = 'foo = 1\nfoo + 1\n'
  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.input(input)
  expect(mirror.querySelectorAll('.tok-code.tok-error').length).toBe(0)

  input.value = 'foo =\nfoo + 1\n'
  input.selectionStart = 5
  input.selectionEnd = 5
  fireEvent.input(input)

  input.selectionStart = input.value.length
  input.selectionEnd = input.value.length
  fireEvent.keyUp(input)

  const errored = mirror.querySelectorAll('.tok-code.tok-error')
  expect(errored.length).toBeGreaterThanOrEqual(2)
})
