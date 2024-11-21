import {AdminSession} from '../session.js'

/**
 * {@link Key} represents the unique identifier of a file in a theme.
 */
export type Key = string

export type ThemeFSEventName = 'add' | 'change' | 'unlink' | 'error'

type ThemeFSEvent =
  | {
      type: 'unlink'
      payload: {fileKey: Key; onSync?: (fn: () => void) => void}
    }
  | {
      type: 'add' | 'change'
      payload: {
        fileKey: Key
        errors: Map<Key, string[]>
        onContent: (fn: (content: string) => void) => void
        onSync: (fn: () => void) => void
      }
    }

export type ThemeFSEventPayload<T extends ThemeFSEventName = 'add'> = (ThemeFSEvent & {type: T})['payload']

export interface ThemeFileSystemOptions {
  filters?: {ignore?: string[]; only?: string[]}
  notify?: string
  noDelete?: boolean
}

/**
 * Represents a theme on the file system.
 */
export interface VirtualFileSystem {
  /**
   * The root path of the theme.
   */
  root: string

  /**
   * Local files.
   */
  files: Map<Key, ThemeAsset>

  /**
   * File keys that have been modified in memory and are not uploaded yet.
   */
  unsyncedFileKeys: Set<Key>

  /**
   * Promise that resolves when all the initial files are found.
   */
  ready: () => Promise<void>

  /**
   * Removes a file from the local disk and updates the file system
   *
   * @param fileKey - The key of the file to remove
   */
  delete: (fileKey: Key) => Promise<void>

  /**
   * Writes a file to the local disk and updates the file system
   *
   * @param asset - The ThemeAsset representing the file to write
   */
  write: (asset: ThemeAsset) => Promise<void>

  /**
   * Reads a file from the local disk and updates the file system
   * Returns a ThemeAsset representing the file that was read
   * Returns undefined if the file does not exist
   *
   * @param fileKey - The key of the file to read
   */
  read: (fileKey: Key) => Promise<string | Buffer | undefined>

  /**
   * Add callbacks to run after certain events are fired.
   */
  addEventListener: <T extends ThemeFSEventName>(eventName: T, cb: (params: ThemeFSEventPayload<T>) => void) => void
}

/**
 * Represents a theme on the file system.
 */
export interface ThemeFileSystem extends VirtualFileSystem {
  /**
   * Starts a file watcher for the theme directory.
   *
   * @param themeId - The ID of the theme being watched.
   * @param adminSession - The admin session for API communication.
   * @returns A Promise that resolves to an FSWatcher instance.
   */
  startWatcher: (themeId: string, adminSession: AdminSession) => Promise<void>

  /**
   * Applies filters to ignore files from .shopifyignore file, --ignore and --only flags.
   */
  applyIgnoreFilters: <T extends {key: string}>(files: T[]) => T[]

  /**
   * Map of file keys to errors.
   */
  errors: Map<string, string[]>

  /**
   * Emits an event to the event emitter.
   */
  emitEvent: <T extends ThemeFSEventName>(eventName: T, payload: ThemeFSEventPayload<T>) => void
}

/**
 * Represents a theme on the file system.
 */
export interface ThemeExtensionFileSystem extends VirtualFileSystem {
  /**
   * Starts a file watcher for the theme extension directory.
   */
  startWatcher: () => Promise<void>
}

/**
 * Represents a theme.
 */
export interface Theme {
  /**
   * The remote ID of the theme.
   */
  id: number

  /**
   * The remote name of the theme.
   */
  name: string

  /**
   * A boolean determining whether or not the theme was created at runtime.
   */
  createdAtRuntime: boolean

  /**
   * A boolean determining if the theme is processing at the theme library.
   */
  processing: boolean

  /**
   * The remote role of the theme.
   */
  role: string

  /**
   * A public URL where Shopify can access the theme code.
   */
  src?: string
}

/**
 * Represents the remote checksum for a file in a theme.
 */
export interface Checksum {
  /**
   * Identifier of the theme file.
   */
  key: Key

  /**
   * Represents the checksum value of the theme file.
   */
  checksum: string
}

/**
 * Represents a theme or theme extension asset.
 */
export interface ThemeAsset extends Checksum {
  /**
   * A base64-encoded image.
   */
  attachment?: string

  /**
   * The text content of the asset, such as the HTML and Liquid markup of a template file.
   */
  value?: string

  /**
   * File stats at time of last modification. For attachments, this is the size of the base64 string.
   */
  stats?: {mtime: number; size: number}
}

/**
 * Represents a single result for an upload or delete operation on a single file
 * Each result includes the unique identifier for the file, the type of the operation,
 * the success status of the operation, any errors that occurred, and the asset value of the file.
 */
export interface Result {
  /**
   * The unique identifier for the file being uploaded.
   */
  key: string

  /**
   * The operation associated with the result.
   */
  operation: Operation

  /**
   * Indicates whether the upload operation for this file was successful.
   */
  success: boolean

  /**
   * Error message that was generated during the upload operation for this file.
   */
  errors?: {asset?: string[]}

  /**
   * The asset that was uploaded as part of the upload operation for this file.
   */
  asset?: Omit<ThemeAsset, 'stats'>
}

export enum Operation {
  Delete = 'DELETE',
  Upload = 'UPLOAD',
}
