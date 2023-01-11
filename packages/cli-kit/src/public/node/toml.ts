import * as toml from '@iarna/toml'

/**
 * Given a TOML string, it returns a JSON object.
 *
 * @param input - TOML string.
 * @returns JSON object.
 */
export function decodeToml(input: string): object {
  return toml.parse(input)
}

/**
 * Given a JSON object, it returns a TOML string.
 *
 * @param content - JSON object.
 * @returns TOML string.
 */
export function encodeToml(content: toml.JsonMap): string {
  return toml.stringify(content)
}
