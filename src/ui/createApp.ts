import { createEditor } from './createEditor'
import {
  clearSharedDocumentFromUrl,
  createDocument,
  deriveDocumentTitle,
  getSharedDocumentFromUrl,
  loadDocumentsState,
  saveDocumentsState,
  setSharedDocumentInUrl,
  type DocumentId,
  type DocumentsStateV1
} from './documents'

export type Theme = 'dark' | 'light'

export type CreateAppOptions = {
  initialValue?: string
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

  let documentsState: DocumentsStateV1 = loadDocumentsState(options.initialValue ?? '')

  const sharedContent = getSharedDocumentFromUrl()
  clearSharedDocumentFromUrl()
  if (sharedContent != null) {
    const existing = documentsState.documents.find((doc) => doc.content === sharedContent)
    if (existing) {
      documentsState.activeId = existing.id
    } else {
      const imported = createDocument(sharedContent)
      documentsState.documents.push(imported)
      documentsState.activeId = imported.id
      saveDocumentsState(documentsState)
    }
  }

  let saveTimer: number | null = null
  const scheduleSave = () => {
    if (saveTimer != null) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTimer = null
      try {
        saveDocumentsState(documentsState)
      } catch {
        // Ignore quota / storage errors.
      }
    }, 400)
  }

  const saveNow = () => {
    if (saveTimer != null) window.clearTimeout(saveTimer)
    saveTimer = null
    try {
      saveDocumentsState(documentsState)
    } catch {
      // Ignore quota / storage errors.
    }
  }

  const header = document.createElement('div')
  header.className = 'appHeader'
  header.dataset.testid = 'app-header'

  const title = document.createElement('div')
  title.className = 'appTitle'
  title.textContent = 'calc'

  const themeToggle = createThemeToggle(theme)

  const headerActions = document.createElement('div')
  headerActions.className = 'headerActions'

  const shareButton = document.createElement('button')
  shareButton.type = 'button'
  shareButton.className = 'shareButton'
  shareButton.textContent = 'Share'
  shareButton.dataset.testid = 'share-button'
  shareButton.addEventListener('click', () => {
    const active = documentsState.documents.find((doc) => doc.id === documentsState.activeId)
    if (!active) return
    setSharedDocumentInUrl(active.content)
  })

  headerActions.append(shareButton, themeToggle.element)

  header.append(title, headerActions)

  const editorPanel = document.createElement('div')
  editorPanel.className = 'editorPanel'
  editorPanel.dataset.testid = 'editor-panel'

  const tabsBar = document.createElement('div')
  tabsBar.className = 'tabsBar'
  tabsBar.dataset.testid = 'tabs-bar'
  tabsBar.setAttribute('role', 'tablist')
  tabsBar.setAttribute('aria-label', 'Documents')

  const editorHost = document.createElement('div')
  editorHost.className = 'editorHost'
  editorHost.dataset.testid = 'editor-host'
  editorHost.setAttribute('role', 'tabpanel')
  editorHost.id = `editor-tabpanel-${Math.random().toString(16).slice(2)}`

  const tabTitleEls = new Map<DocumentId, HTMLElement>()
  const tabSelectButtons = new Map<DocumentId, HTMLButtonElement>()
  const tabCloseButtons = new Map<DocumentId, HTMLButtonElement>()

  const getActiveDoc = () => {
    return documentsState.documents.find((doc) => doc.id === documentsState.activeId) ?? null
  }

  const mountEditor = () => {
    const active = getActiveDoc()
    if (!active) return

    editorHost.replaceChildren()
    const editor = createEditor({
      initialValue: active.content,
      onChange: (value) => {
        const doc = getActiveDoc()
        if (!doc) return
        doc.content = value
        doc.updatedAt = Date.now()
        const titleEl = tabTitleEls.get(doc.id)
        const nextTitle = deriveDocumentTitle(doc.content)
        if (titleEl) titleEl.textContent = nextTitle
        const closeButton = tabCloseButtons.get(doc.id)
        if (closeButton) closeButton.setAttribute('aria-label', `Close tab: ${nextTitle}`)
        scheduleSave()
      }
    })
    editorHost.append(editor)
  }

  const setActive = (id: DocumentId, autofocus: boolean = false) => {
    if (documentsState.activeId === id) return
    documentsState.activeId = id
    renderTabs()
    mountEditor()
  }

  const addNewDocument = () => {
    const doc = createDocument('')
    documentsState.documents.push(doc)
    documentsState.activeId = doc.id
    renderTabs()
    mountEditor()
    const input = editorHost.querySelector<HTMLTextAreaElement>('textarea')
    input?.focus()
    saveNow()
  }

  const deleteDocument = (id: DocumentId) => {
    const index = documentsState.documents.findIndex((doc) => doc.id === id)
    if (index === -1) return

    if (!window.confirm('Delete this tab? This cannot be undone.')) return

    documentsState.documents.splice(index, 1)
    tabTitleEls.delete(id)

    if (documentsState.documents.length === 0) {
      const replacement = createDocument('')
      documentsState.documents = [replacement]
      documentsState.activeId = replacement.id
    } else if (documentsState.activeId === id) {
      const next = documentsState.documents[Math.min(index, documentsState.documents.length - 1)]
      documentsState.activeId = next.id
    }

    renderTabs()
    mountEditor(false)
    saveNow()
  }

  const renderTabs = () => {
    tabTitleEls.clear()
    tabSelectButtons.clear()
    tabCloseButtons.clear()
    tabsBar.replaceChildren()

    for (const doc of documentsState.documents) {
      const tab = document.createElement('div')
      tab.className = 'tab'
      tab.dataset.docid = doc.id

      const select = document.createElement('button')
      select.type = 'button'
      select.className = 'tabSelect'
      select.setAttribute('role', 'tab')
      select.id = `doc-tab-${doc.id}`
      select.setAttribute('aria-controls', editorHost.id)
      select.dataset.testid = `tab-${doc.id}`
      select.setAttribute('aria-selected', String(doc.id === documentsState.activeId))
      select.tabIndex = doc.id === documentsState.activeId ? 0 : -1
      if (doc.id === documentsState.activeId) select.classList.add('isActive')
      select.addEventListener('click', () => setActive(doc.id))
      select.addEventListener('keydown', (event) => {
        const ids = documentsState.documents.map((row) => row.id)
        const currentIndex = ids.indexOf(doc.id)
        if (currentIndex === -1) return

        const focusAndSelect = (nextIndex: number) => {
          const clamped = Math.max(0, Math.min(ids.length - 1, nextIndex))
          const nextId = ids[clamped]
          setActive(nextId)
          const nextButton = tabSelectButtons.get(nextId)
          nextButton?.focus()
          nextButton?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          focusAndSelect(currentIndex - 1)
          return
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          focusAndSelect(currentIndex + 1)
          return
        }
        if (event.key === 'Home') {
          event.preventDefault()
          focusAndSelect(0)
          return
        }
        if (event.key === 'End') {
          event.preventDefault()
          focusAndSelect(ids.length - 1)
          return
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault()
          deleteDocument(doc.id)
        }
      })

      const titleEl = document.createElement('span')
      titleEl.className = 'tabTitle'
      titleEl.textContent = deriveDocumentTitle(doc.content)
      tabTitleEls.set(doc.id, titleEl)
      tabSelectButtons.set(doc.id, select)
      select.append(titleEl)

      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'tabClose'
      close.textContent = '×'
      close.setAttribute('aria-label', `Close tab: ${deriveDocumentTitle(doc.content)}`)
      close.tabIndex = -1
      close.dataset.testid = `tab-close-${doc.id}`
      close.addEventListener('click', (event) => {
        event.stopPropagation()
        deleteDocument(doc.id)
      })
      tabCloseButtons.set(doc.id, close)

      tab.append(select, close)
      tabsBar.append(tab)
    }

    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'tabAdd'
    add.textContent = '+'
    add.setAttribute('aria-label', 'New tab')
    add.dataset.testid = 'tab-add'
    add.addEventListener('click', () => addNewDocument())
    tabsBar.append(add)

    const active = documentsState.activeId
    editorHost.setAttribute('aria-labelledby', `doc-tab-${active}`)
  }

  renderTabs()
  mountEditor()
  saveNow()

  editorPanel.append(tabsBar, editorHost)
  app.append(header, editorPanel)
  return app
}
