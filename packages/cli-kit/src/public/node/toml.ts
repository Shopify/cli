import {JsonMap} from '../../private/common/json.js'
import * as toml from '@iarna/toml'
import {Liquid} from 'liquidjs';
import {readAndParseDotEnv } from './dot-env.js'
import {fileExists} from './fs.js'
import {joinPath, cwd} from './path.js'

export type JsonMapType = JsonMap

/**
 * Given a TOML string, it returns a JSON object.
 * Before parsing as TOML the string is passed through a
 * Liquid renderer with access to environment variables.
 *
 * @param input - TOML string.
 * @returns JSON object.
 */
export async function decodeToml(input: string): JsonMapType {
  const engine = new Liquid()
  const normalizedInput = input.replace(/\r\n$/g, '\n')

  let envData = process.env;
  const envFile = joinPath(cwd(), '.env');
  if (await fileExists(envFile)) {
    const dotenv = await readAndParseDotEnv(envFile);
    envData = { ...envData, ...dotenv.variables };
  }

  const renderedInput = await engine.render(engine.parse(normalizedInput), { env: envData });
  return toml.parse(renderedInput);
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
