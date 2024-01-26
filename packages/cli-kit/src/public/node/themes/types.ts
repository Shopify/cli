/**
 * {@link Key} represents the unique identifier of a file in a theme.
 */
export type Key = string

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
