import {mkdir, readFile, writeFile} from 'node:fs/promises'
// Keep storage setup independent of CLI singletons in the worker.
// eslint-disable-next-line no-restricted-imports
import {dirname, sep} from 'node:path'

export interface StoredState {
  authentication?: {
    /** Decoded sessions, including their identity-host and user-ID keys. */
    sessions?: unknown
    /** Escape hatch for empty or intentionally malformed serialized session data. */
    serializedSessions?: string
    /** Omit to preserve selection; an explicit undefined removes it. */
    currentSessionId?: string
  }
  appPreferences?: Record<string, unknown>
  cliPreferences?: {autoUpgradeEnabled?: boolean}
  /** Replaces the cache map. An empty object deliberately clears all entries. */
  caches?: Record<string, unknown>
}

interface StorePaths {
  project: string
  app: string
  cliKit: string
}

async function readStore(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return {}
  }
}

async function writeStore(path: string, value: Record<string, unknown>) {
  await mkdir(dirname(path), {recursive: true})
  await writeFile(path, JSON.stringify(value))
}

export async function seedStoredState(paths: StorePaths, state: StoredState) {
  if (state.authentication || state.cliPreferences || state.caches !== undefined) {
    const store = await readStore(paths.cliKit)
    const authentication = state.authentication
    if (authentication) {
      if (Object.hasOwn(authentication, 'sessions') && Object.hasOwn(authentication, 'serializedSessions')) {
        throw new Error('Supply decoded sessions or serializedSessions, not both')
      }
      if (Object.hasOwn(authentication, 'sessions')) store.sessionStore = JSON.stringify(authentication.sessions)
      if (Object.hasOwn(authentication, 'serializedSessions')) store.sessionStore = authentication.serializedSessions
      if (Object.hasOwn(authentication, 'currentSessionId')) store.currentSessionId = authentication.currentSessionId
    }
    Object.assign(store, state.cliPreferences)
    if (state.caches !== undefined) store.cache = state.caches
    await writeStore(paths.cliKit, store)
  }
  if (state.appPreferences) {
    const store = await readStore(paths.app)
    // Match conf's dot-notation lookup, including dots in project paths.
    const keys = paths.project.split(sep).join('/').split('.')
    let parent = store
    for (const key of keys.slice(0, -1)) {
      const existing = parent[key]
      const child =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as Record<string, unknown>)
          : {}
      parent[key] = child
      parent = child
    }
    parent[keys.at(-1)!] = {directory: paths.project, ...state.appPreferences}
    await writeStore(paths.app, store)
  }
}
