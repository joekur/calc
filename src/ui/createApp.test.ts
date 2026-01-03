import { expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { compressToEncodedURIComponent } from 'lz-string'
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
  localStorage.removeItem('calc.documents.v1')
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

test('tab title defaults to first line and strips leading # for comments', async () => {
  ensureThemeLinks()
  document.querySelectorAll('[data-testid="app"]').forEach((node) => node.remove())
  localStorage.removeItem('calc.documents.v1')
  const app = createApp({ initialValue: '# My calc doc\n2 + 2\n' })
  document.body.append(app)

  const tabs = page.getByTestId('tabs-bar').element()
  const titles = Array.from(tabs.querySelectorAll<HTMLElement>('.tabTitle')).map(
    (el) => el.textContent
  )
  expect(titles[0]).toBe('My calc doc')
})

test('adds and deletes tabs and persists documents', async () => {
  ensureThemeLinks()
  document.querySelectorAll('[data-testid="app"]').forEach((node) => node.remove())
  localStorage.removeItem('calc.documents.v1')
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

  const app = createApp({ initialValue: 'First doc\n' })
  document.body.append(app)

  const add = page.getByTestId('tab-add')
  await userEvent.click(add)

  const tabsAfterAdd = page.getByTestId('tabs-bar').element()
  expect(tabsAfterAdd.querySelectorAll('.tab').length).toBe(2)

  const closeButtons = Array.from(tabsAfterAdd.querySelectorAll<HTMLButtonElement>('.tabClose'))
  expect(closeButtons.length).toBe(2)
  await userEvent.click(closeButtons[0])

  const tabsAfterDelete = page.getByTestId('tabs-bar').element()
  expect(tabsAfterDelete.querySelectorAll('.tab').length).toBe(1)
  expect(confirmSpy).toHaveBeenCalled()

  const stored = localStorage.getItem('calc.documents.v1')
  expect(stored).toBeTruthy()
  if (stored) {
    const parsed = JSON.parse(stored)
    expect(parsed.version).toBe(1)
    expect(Array.isArray(parsed.documents)).toBe(true)
    expect(parsed.documents.length).toBe(1)
  }
})

test('imports shared document from URL into tabs', async () => {
  ensureThemeLinks()
  document.querySelectorAll('[data-testid="app"]').forEach((node) => node.remove())
  localStorage.removeItem('calc.documents.v1')

  const shared = '# Shared doc\n2 + 2\n'
  const compressed = compressToEncodedURIComponent(shared)
  window.history.replaceState(null, '', `/?doc=${compressed}`)

  const app = createApp({ initialValue: '' })
  document.body.append(app)

  const input = page.getByRole('textbox', { name: 'Editor' })
  expect(input.element().value).toBe(shared)
  expect(window.location.search).toBe('')

  const stored = localStorage.getItem('calc.documents.v1')
  expect(stored).toContain('Shared doc')
})
