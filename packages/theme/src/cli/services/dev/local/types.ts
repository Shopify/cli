import {LiveReload} from '../../../utilities/theme-environment/types.js'
import {ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

/**
 * Options accepted by the local dev server entry point `devServe`.
 *
 * This mirrors the subset of `dev()`'s options that the local flow needs. It
 * deliberately omits the remote-Storefront-Renderer concerns (session refresh,
 * storefront password, theme-editor sync) because the local server renders
 * locally and never talks to the remote storefront.
 */
export interface DevServeOptions {
  directory: string
  store: string
  host: string
  port: number
  onBoot: () => void
  onShutdown: () => void
}

/**
 * Internal context threaded to the local server's collaborators (middleware,
 * watcher, transport). It is a trimmed mirror of `DevServerContext` with no
 * remote session or Storefront-Renderer state.
 */
export interface LocalDevServerContext {
  directory: string
  host: string
  port: number
  liveReload: LiveReload
  localThemeFileSystem: ThemeFileSystem
  /* Tracks the last requested HTML path, mirroring the remote flow. */
  lastRequestedPath: string
  /* The render seam — see renderer.ts. */
  renderer: ThemeRenderer
}

/**
 * A render request handed to the render seam. Kept minimal for the
 * hello-world draft; a real renderer can read more fields later without
 * changing the seam's shape for existing callers.
 */
export interface RenderRequest {
  path: string
  method: string
  headers: Record<string, string>
}

/**
 * The result a `ThemeRenderer` produces for a request.
 */
export interface RenderResult {
  body: string
  status: number
  headers: Record<string, string>
}

/**
 * THE RENDER SEAM.
 *
 * Server and middleware depend on this interface, never on a concrete
 * implementation. The draft ships `helloWorldRenderer`; a real local Liquid
 * renderer implements the same interface later with zero changes upstream.
 */
export interface ThemeRenderer {
  render(request: RenderRequest): Promise<RenderResult>
}

/**
 * Reload events pushed to the browser over the transport. The draft only ever
 * emits `{type: 'full'}` (full-page reload). The union leaves room for
 * granular events (e.g. section/css updates) in a later iteration without
 * breaking the wire contract.
 */
export interface ReloadEvent {
  type: 'full'
}

/**
 * A normalized file-change event emitted by the watcher.
 */
export interface ChangeEvent {
  type: ThemeFileChangeType
  path: string
}

export type ThemeFileChangeType = 'add' | 'change' | 'unlink'
