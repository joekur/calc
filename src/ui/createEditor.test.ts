import { fireEvent } from '@testing-library/dom'
import { expect, test } from 'vitest'
import { createEditor } from './createEditor'

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
