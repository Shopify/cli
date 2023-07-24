import {JsonMap} from '../../private/common/json.js'
import * as toml from '@iarna/toml'

export type JsonMapType = JsonMap

/**
 * Given a TOML string, it returns a JSON object.
 *
 * @param input - TOML string.
 * @returns JSON object.
 */
export function decodeToml(input: string): object {
  const normalizedInput = input.replace(/\r\n$/g, '\n')
  return toml.parse(normalizedInput)
}

/**
 * Given a JSON object, it returns a TOML string.
 *
 * @param content - JSON object.
 * @returns TOML string.
 */
export function encodeToml(content: JsonMap | object): string {
  // our JsonMap type is fine with nulls/undefined, but the typing for TOML library isn't.
  const tomlSafeContent = content as toml.JsonMap
  return toml.stringify(tomlSafeContent)
}
