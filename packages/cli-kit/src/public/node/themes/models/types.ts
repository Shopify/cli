/**
 * {@link Key} is a type alias for a string and represents the unique
 * identifier of a file in a theme.
 */
export type Key = string

/**
 * Represents the remote checksum for a file in a theme.
 */
export interface Checksum {
  /**
   * Identifier of the theme file.
   */
  key: Key

  /**
   * A string representing the remote checksum value of the theme file.
   */
  checksum: string
}

/**
 * Represents a local theme stored on the file system.
 */
export interface LocalTheme {
  /**
   * The root path of the theme.
   */
  root: string

  /**
   * A Map of theme files indexed by {@link Key}.
   */
  files: Map<Key, File>
}

/**
 * Represents a local file in a theme.
 */
export interface File {
  /**
   * A string which represents the unique identifier of the theme file.
   */
  key: Key

  /**
   * The MD5 representation of the content, consisting of a string of 32
   * hexadecimal digits. May be null if an asset has not been updated recently.
   */
  checksum?: string
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
   * A Map of theme files indexed by {@link Key}.
   */
  files: Map<Key, File>

  /**
   * The remote role of the theme.
   */
  role: string
}

/**
 * Represents a file in a theme.
 */
export interface ThemeAsset {
  /**
   * A string which represents the unique identifier of the theme file.
   */
  key: Key

  /**
   * A string which represents a base64-encoded image.
   */
  attachment?: string

  /**
   * The text content of the asset, such as the HTML and Liquid markup of a template file.
   */
  value?: string
}
