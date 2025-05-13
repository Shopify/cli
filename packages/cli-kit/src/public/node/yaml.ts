import {JsonMapType} from '@shopify/cli-kit/node/toml'
import YAML from 'yaml'

/**
 * Given a YAML string, it returns an object.
 *
 * @param input - YAML string.
 * @returns Object.
 */
export function decodeYaml(input: string): JsonMapType {
  const normalizedInput = input.replace(/\r\n$/g, '\n')
  return YAML.parse(normalizedInput)
}

/**
 * Given an object, it returns a YAML string.
 *
 * @param content - Object.
 * @returns YAML string.
 */
export function encodeYaml(content: JsonMapType | object): string {
  return YAML.stringify(content)
}
