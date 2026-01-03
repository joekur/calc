import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

export type DocumentId = string

export type DocumentRecord = {
  id: DocumentId
  content: string
  createdAt: number
  updatedAt: number
}

export type DocumentsStateV1 = {
  version: 1
  activeId: DocumentId
  documents: DocumentRecord[]
}

const documentsStorageKey = 'calc.documents.v1'

const titleMaxChars = 28

function createId(): string {
  const cryptoObj = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
  return `doc_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function deriveDocumentTitle(content: string): string {
  const firstLine = (content.split('\n')[0] ?? '').trim()
  let title = firstLine

  if (title.startsWith('#')) {
    title = title.slice(1).trimStart()
  }

  if (title === '') title = 'Untitled'

  if (title.length > titleMaxChars) {
    return `${title.slice(0, titleMaxChars - 1)}…`
  }

  return title
}

export function createDocument(content: string): DocumentRecord {
  const now = Date.now()
  return { id: createId(), content, createdAt: now, updatedAt: now }
}

function normalizeLoadedState(value: unknown): DocumentsStateV1 | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<DocumentsStateV1>
  if (record.version !== 1) return null
  if (typeof record.activeId !== 'string') return null
  if (!Array.isArray(record.documents)) return null
  const documents: DocumentRecord[] = []
  for (const doc of record.documents) {
    if (!doc || typeof doc !== 'object') return null
    const row = doc as Partial<DocumentRecord>
    if (typeof row.id !== 'string') return null
    if (typeof row.content !== 'string') return null
    if (typeof row.createdAt !== 'number') return null
    if (typeof row.updatedAt !== 'number') return null
    documents.push({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
  return { version: 1, activeId: record.activeId, documents }
}

export function loadDocumentsState(seedContent: string = ''): DocumentsStateV1 {
  try {
    const raw = window.localStorage.getItem(documentsStorageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      const normalized = normalizeLoadedState(parsed)
      if (normalized && normalized.documents.length > 0) {
        const hasActive = normalized.documents.some((doc) => doc.id === normalized.activeId)
        if (hasActive) return normalized
        return { ...normalized, activeId: normalized.documents[0].id }
      }
    }
  } catch {
    // Ignore malformed storage.
  }

  const first = createDocument(seedContent)
  return { version: 1, activeId: first.id, documents: [first] }
}

export function saveDocumentsState(state: DocumentsStateV1) {
  window.localStorage.setItem(documentsStorageKey, JSON.stringify(state))
}

export function getSharedDocumentFromUrl(): string | null {
  const url = new URL(window.location.href)
  const compressed = url.searchParams.get('doc')
  if (!compressed) return null
  const decoded = decompressFromEncodedURIComponent(compressed)
  if (decoded == null) return null
  return decoded
}

export function setSharedDocumentInUrl(content: string) {
  const compressed = compressToEncodedURIComponent(content)
  const url = new URL(window.location.href)
  url.searchParams.set('doc', compressed)
  window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`)
}

export function clearSharedDocumentFromUrl(): boolean {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('doc')) return false
  url.searchParams.delete('doc')
  const search = url.searchParams.toString()
  window.history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash}`)
  return true
}
