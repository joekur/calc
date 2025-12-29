import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { createApp } from './createApp'

function ensureThemeLinks() {
  const ensure = (id: string, href: string, media: string) => {
    let link = document.querySelector<HTMLLinkElement>(`#${id}`)
    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = href
      link.media = media
      document.head.append(link)
    }
    return link
  }

  ensure('theme-dark', '/src/themes/dark.css', '(prefers-color-scheme: dark)')
  ensure('theme-light', '/src/themes/light.css', '(prefers-color-scheme: light)')
}

function mountApp(): ReturnType<typeof page.getByTestId> {
  document.querySelectorAll('[data-testid="app"]').forEach((node) => node.remove())
  const app = createApp({ initialValue: '2 + 2\n' })
  document.body.append(app)
  return page.getByTestId('app')
}

test('theme toggle sets document theme and persists selection', async () => {
  ensureThemeLinks()
  localStorage.setItem('calc.theme', 'dark')
  mountApp()

  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(document.querySelector<HTMLLinkElement>('#theme-dark')?.media).toBe('all')
  expect(document.querySelector<HTMLLinkElement>('#theme-light')?.media).toBe('not all')

  const light = page.getByTestId('theme-light')
  await userEvent.click(light)

  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('calc.theme')).toBe('light')
  expect(document.querySelector<HTMLLinkElement>('#theme-dark')?.media).toBe('not all')
  expect(document.querySelector<HTMLLinkElement>('#theme-light')?.media).toBe('all')

  const dark = page.getByTestId('theme-dark')
  await userEvent.click(dark)

  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('calc.theme')).toBe('dark')
  expect(document.querySelector<HTMLLinkElement>('#theme-dark')?.media).toBe('all')
  expect(document.querySelector<HTMLLinkElement>('#theme-light')?.media).toBe('not all')
})
