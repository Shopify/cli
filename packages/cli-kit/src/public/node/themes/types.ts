import type {Stats} from 'fs'

/**
 * {@link Key} represents the unique identifier of a file in a theme.
 */
export type Key = string

interface ThemeFSEventPayload {
  fileKey: string
  syncPromise: Promise<void>
  contentPromise: Promise<string>
}

export type ThemeFSEventName = 'add' | 'change' | 'unlink'
export type ThemeFSEvent<T extends ThemeFSEventName> = T extends 'unlink'
  ? {type: 'unlink'; payload: Omit<ThemeFSEventPayload, 'contentPromise'>}
  : {
      type: 'add' | 'change'
      payload: ThemeFSEventPayload
    }

interface AddEventListener {
  (eventName: 'unlink', cb: (params: ThemeFSEvent<'unlink'>['payload']) => void): void
  (eventName: 'add' | 'change', cb: (params: ThemeFSEvent<'add'>['payload']) => void): void
}

/**
 * Represents a theme on the file system.
 */
export interface ThemeFileSystem {
  /**
   * The root path of the theme.
   */
  root: string

  /**
   * Local theme files.
   */
  files: Map<Key, ThemeAsset>

  /**
   * Promise that resolves when all the initial files are found.
   */
  ready: () => Promise<void>

  /**
   * Removes a file from the local disk and updates the themeFileSystem
   *
   * @param assetKey - The key of the file to remove
   */
  delete: (assetKey: string) => Promise<void>

  /**
   * Writes a file to the local disk and updates the themeFileSystem
   *
   * @param asset - The ThemeAsset representing the file to write
   */
  write: (asset: ThemeAsset) => Promise<void>

  /**
   * Reads a file from the local disk and updates the themeFileSystem
   * Returns a ThemeAsset representing the file that was read
   * Returns undefined if the file does not exist
   *
   * @param assetKey - The key of the file to read
   */
  read: (assetKey: string) => Promise<string | Buffer | undefined>

  /**
   * Gets the stats of a file from the local disk and updates the themeFileSystem
   * Returns undefined if the file does not exist
   *
   * @param assetKey - The key of the file to read
   */
  stat: (assetKey: string) => Promise<Pick<Stats, 'mtime' | 'size'> | undefined>

  /**
   * Add callbacks to run after certain events are fired.
   */
  addEventListener: AddEventListener
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
   * Reresents the checksum value of the theme file.
   */
  checksum: string
}

/**
 * Represents a file in a theme.
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
}

/**
 * Represents a single result for a upload or delete operation on a single file
 * Each result includes the unique identifier for the file, the type of the operation,
 * the sucesss status of the operation, any errors that occurred, and the asset value of the file.
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

  /* *
   * Indicates whether the upload operation for this file was successful.
   */
  success: boolean

  /**
   * Error message that was generated during the upload operation for this file.
   */
  errors?: {asset?: string[]}

  /* *
   * The asset that was uploaded as part of the upload operation for this file.
   */
  asset?: ThemeAsset
}

export enum Operation {
  Delete = 'DELETE',
  Upload = 'UPLOAD',
}
