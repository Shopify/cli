import {JsonMapType, decodeToml, encodeToml} from './codec.js'
import {readFile, writeFile} from '../fs.js'
import {updateTomlValues} from '@shopify/toml-patch'

type TomlPatchValue = string | number | boolean | undefined | (string | number | boolean)[]

/**
 * Thrown when a TOML file cannot be parsed. Includes the file path for context.
 */
export class TomlParseError extends Error {
  readonly path: string

  constructor(path: string, cause: Error) {
    super(`Fix the following error in ${path}:\n${cause.message}`)
    this.name = 'TomlParseError'
    this.path = path
  }
}

/**
 * General-purpose TOML file abstraction.
 *
 * Provides a unified interface for reading, patching, removing keys from, and replacing
 * the content of TOML files on disk.
 *
 * - `read` populates content from disk
 * - `patch` does surgical WASM-based edits (preserves comments and formatting)
 * - `remove` deletes a key by dotted path (preserves comments and formatting)
 * - `replace` does a full re-serialization (comments and formatting are NOT preserved).
 * - `transformRaw` applies a function to the raw TOML string on disk.
 */
export class TomlFile {
  /**
   * Read and parse a TOML file from disk. Throws if the file doesn't exist or contains invalid TOML.
   * Parse errors are wrapped in {@link TomlParseError} with the file path for context.
   *
   * @param path - Absolute path to the TOML file.
   * @returns A TomlFile instance with parsed content.
   */
  static async read(path: string): Promise<TomlFile> {
    const raw = await readFile(path)
    const file = new TomlFile(path, {})
    file.content = file.decode(raw)
    return file
  }

  readonly path: string
  content: JsonMapType

  constructor(path: string, content: JsonMapType) {
    this.path = path
    this.content = content
  }

  /**
   * Surgically patch values in the TOML file, preserving comments and formatting.
   *
   * Accepts a nested object whose leaf values are set in the TOML. Intermediate tables are
   * created automatically. Setting a leaf to `undefined` removes it (use `remove()` for a
   * clearer API when deleting keys).
   *
   * @example
   * ```ts
   * await file.patch({build: {dev_store_url: 'my-store.myshopify.com'}})
   * await file.patch({application_url: 'https://example.com', auth: {redirect_urls: ['...']}})
   * ```
   */
  async patch(changes: {[key: string]: unknown}): Promise<void> {
    const patches = flattenToPatchEntries(changes)
    const raw = await readFile(this.path)
    const updated = updateTomlValues(raw, patches)
    const parsed = this.decode(updated)
    await writeFile(this.path, updated)
    this.content = parsed
  }

  /**
   * Remove a key from the TOML file by dotted path, preserving comments and formatting.
   *
   * @param keyPath - Dotted key path to remove (e.g. 'build.include_config_on_deploy').
   * @example
   * ```ts
   * await file.remove('build.include_config_on_deploy')
   * ```
   */
  async remove(keyPath: string): Promise<void> {
    const keys = keyPath.split('.')
    const raw = await readFile(this.path)
    const updated = updateTomlValues(raw, [[keys, undefined]])
    const parsed = this.decode(updated)
    await writeFile(this.path, updated)
    this.content = parsed
  }

  /**
   * Replace the entire file content. The file is fully re-serialized — comments and formatting
   * are NOT preserved.
   *
   * @param content - The new content to write.
   * @example
   * ```ts
   * await file.replace({client_id: 'abc', name: 'My App'})
   * ```
   */
  async replace(content: JsonMapType): Promise<void> {
    const encoded = encodeToml(content)
    this.decode(encoded)
    await writeFile(this.path, encoded)
    this.content = content
  }

  /**
   * Transform the raw TOML string on disk. Reads the file, applies the transform function
   * to the raw text, writes back, and re-parses to keep `content` in sync.
   *
   * Use this for text-level operations that can't be expressed as structured edits —
   * e.g. Injecting comments or positional insertion of keys in arrays-of-tables.
   * Subsequent `patch()` calls will preserve any comments added this way.
   *
   * @param transform - A function that receives the raw TOML string and returns the modified string.
   * @example
   * ```ts
   * await file.transformRaw((raw) => `# Header comment\n${raw}`)
   * ```
   */
  async transformRaw(transform: (raw: string) => string): Promise<void> {
    const raw = await readFile(this.path)
    const transformed = transform(raw)
    const parsed = this.decode(transformed)
    await writeFile(this.path, transformed)
    this.content = parsed
  }

  private decode(raw: string): JsonMapType {
    try {
      return decodeToml(raw)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.line !== undefined && err.col !== undefined) {
        throw new TomlParseError(this.path, err)
      }
      throw err
    }
  }
}

/**
 * Flatten a nested object into an array of `[keyPath, value]` patch entries
 * suitable for `updateTomlValues`.
 *
 * @param obj - The nested object to flatten.
 * @param prefix - Key path prefix for recursion.
 * @returns Flattened patch entries.
 */
function flattenToPatchEntries(obj: {[key: string]: unknown}, prefix: string[] = []): [string[], TomlPatchValue][] {
  const entries: [string[], TomlPatchValue][] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key]
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flattenToPatchEntries(value as {[key: string]: unknown}, path))
    } else {
      entries.push([path, value as TomlPatchValue])
    }
  }
  return entries
}
