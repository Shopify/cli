import {AdminSession} from '@shopify/cli-kit/node/session'
import {ThemeExtensionFileSystem, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

/**
 * Defines an authentication session for the theme development server.
 *
 * The AdminSession powers all API interactions with the Assets API, while
 * storefrontToken and storefrontPassword enable interactions with the
 * Storefront API.
 *
 * This session supports extended durations which can exceed 1h,
 * and includes a field to track when the session was last refreshed.
 */
export interface DevServerSession extends AdminSession {
  /**
   * Token to authenticate section rendering API calls.
   */
  storefrontToken: string

  /**
   * Password for accessing password-protected stores.
   */
  storefrontPassword?: string

  /**
   * This holds all cookies that impact the rendering of the development server.
   *
   * Currently, there are only two cookies that impact rendering:
   *
   *   - storefront_digest: This cookie identifies an authenticated
   *                        session, allowing rendering to occur in a
   *                        password-protected storefront.
   *
   *   - _shopify_essential: This cookie identifies the session, which is
   *                         crucial for determining the theme used during
   *                         rendering.
   */
  sessionCookies: {[key: string]: string}

  /**
   * Refreshes the current session, ensuring any tokens and session cookies
   * are up-to-date.
   */
  refresh?: () => Promise<AdminSession>
}

/**
 * Mode for live reload behavior. Options: ['hot-reload', 'full-page', 'off']
 */
export type LiveReload = 'hot-reload' | 'full-page' | 'off'

/**
 * Controls the visibility of the error overlay when an asset upload fails. Options: ['silent', 'default']
 * - silent: Prevents the error overlay from appearing.
 * - default: Displays the error overlay.
 */
export type ErrorOverlayMode = 'silent' | 'default'

/**
 * Maintains the state of local and remote assets in theme development server.
 */
export interface DevServerContext {
  /**
   * Authentication session for development server operations.
   */
  session: DevServerSession

  /**
   * File system tracking local theme assets.
   */
  localThemeFileSystem: ThemeFileSystem

  /**
   * File system tracking local theme extension assets.
   */
  localThemeExtensionFileSystem: ThemeExtensionFileSystem

  /**
   * Path to the local theme directory.
   */
  directory: string

  /**
   * Identifies whether this context is for a theme or a theme extension.
   */
  type: 'theme' | 'theme-extension'

  /**
   * Additional options for the development server.
   */
  options: {
    /**
     * Indicates if theme editor changes are periodically pulled to the local
     * theme.
     */
    themeEditorSync: boolean

    /**
     * Prevents deletion of local files.
     */
    noDelete: boolean

    /**
     * Glob patterns ignore-list for file reconciliation and synchronization.
     */
    ignore: string[]

    /**
     * Glob patterns allow-list for file reconciliation and synchronization.
     */
    only: string[]

    /**
     * Network interface to bind the development server to.
     */
    host: string

    /**
     * Port to bind the development server to.
     */
    port: string

    /**
     * Mode for live reload behavior. Options: ['hot-reload', 'full-page', 'off']
     */
    liveReload: LiveReload

    /**
     * Automatically open the theme preview in the default browser.
     */
    open: boolean

    /**
     * Controls the visibility of the error overlay when an asset upload fails.
     */
    errorOverlay: ErrorOverlayMode
  }
}

/**
 * Context for rendering pages in the development server.
 *
 * Holds properties that modify and influence how pages are rendered using
 * different themes and settings, including section-specific rendering
 */
export interface DevServerRenderContext {
  /**
   * URL path to be rendered.
   */
  path: string

  /**
   * HTTP method to be used during the rendering.
   */
  method: 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE'

  /**
   * Theme identifier for rendering.
   */
  themeId: string

  /**
   * Query parameters to be used during rendering.
   */
  query: [string, string][]

  /**
   * Optional identifier for rendering only a specific section.
   */
  sectionId?: string

  /**
   * Optional identifier for rendering only a specific app block.
   */
  appBlockId?: string

  /**
   * Headers to be used in the rendering request.
   */
  headers: {[key: string]: string}

  /**
   * Custom content to be replaced in the theme during rendering.
   */
  replaceTemplates?: {[key: string]: string}

  /**
   * Custom content to be replaced during rendering.
   */
  replaceExtensionTemplates?: {[key: string]: string}
}
