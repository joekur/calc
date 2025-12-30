import { createEditor } from './createEditor'

export type Theme = 'dark' | 'light'

export type CreateAppOptions = {
  initialValue?: string
  autofocus?: boolean
}

const storageKey = 'calc.theme'

function getThemeLinkElements(): { dark: HTMLLinkElement; light: HTMLLinkElement } | null {
  const dark = document.querySelector<HTMLLinkElement>('#theme-dark')
  const light = document.querySelector<HTMLLinkElement>('#theme-light')
  if (!dark || !light) return null
  return { dark, light }
}

function rememberDefaultMedia(link: HTMLLinkElement) {
  if (!link.dataset.defaultMedia) link.dataset.defaultMedia = link.media
}

function applyThemeOverride(theme: Theme | null) {
  const links = getThemeLinkElements()
  if (!links) return

  rememberDefaultMedia(links.dark)
  rememberDefaultMedia(links.light)

  if (!theme) {
    document.documentElement.removeAttribute('data-theme')
    links.dark.media = links.dark.dataset.defaultMedia ?? '(prefers-color-scheme: dark)'
    links.light.media = links.light.dataset.defaultMedia ?? '(prefers-color-scheme: light)'
    document.documentElement.style.colorScheme = ''
    window.localStorage.removeItem(storageKey)
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  window.localStorage.setItem(storageKey, theme)

  if (theme === 'dark') {
    links.dark.media = 'all'
    links.light.media = 'not all'
  } else {
    links.dark.media = 'not all'
    links.light.media = 'all'
  }
}

function createThemeToggle(initialTheme: Theme) {
  const group = document.createElement('div')
  group.className = 'themeToggle'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Theme')
  group.dataset.testid = 'theme-toggle'

  const createButton = (theme: Theme, label: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'themeToggleButton'
    button.textContent = label
    button.dataset.theme = theme
    button.dataset.testid = `theme-${theme}`
    button.setAttribute('aria-pressed', String(theme === initialTheme))
    return button
  }

  const darkButton = createButton('dark', 'Dark')
  const lightButton = createButton('light', 'Light')

  const setActive = (next: Theme) => {
    applyThemeOverride(next)
    darkButton.setAttribute('aria-pressed', String(next === 'dark'))
    lightButton.setAttribute('aria-pressed', String(next === 'light'))
  }

  darkButton.addEventListener('click', () => setActive('dark'))
  lightButton.addEventListener('click', () => setActive('light'))

  group.append(darkButton, lightButton)
  return { element: group, setActive }
}

export function createApp(options: CreateAppOptions = {}): HTMLElement {
  const stored = window.localStorage.getItem(storageKey)
  const storedTheme: Theme | null = stored === 'dark' || stored === 'light' ? stored : null

  if (storedTheme) applyThemeOverride(storedTheme)

  const theme =
    storedTheme ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

  const app = document.createElement('div')
  app.className = 'app'
  app.dataset.testid = 'app'

  const header = document.createElement('div')
  header.className = 'appHeader'
  header.dataset.testid = 'app-header'

  const title = document.createElement('div')
  title.className = 'appTitle'
  title.textContent = 'calc'

  const themeToggle = createThemeToggle(theme)

  header.append(title, themeToggle.element)

  const editor = createEditor({
    initialValue: options.initialValue,
    autofocus: options.autofocus
  })

  app.append(header, editor)
  return app
}
