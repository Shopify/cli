import {EsbuildEnvVarRegex} from '../constants.js'
import {pickBy} from '@shopify/cli-kit/common/object'

/**
 * Merges the app environment variables with the ones esbuild can inline from the process environment.
 *
 * Process variables take precedence, and those whose name esbuild cannot express as an identifier
 * are left out.
 *
 * @param appEnv - Environment variables defined by the app, for example from its .env file.
 * @param processEnv - Environment variables of the current process.
 * @returns The merged environment variables.
 */
export function esbuildEnvironment(
  appEnv: {[variable: string]: string | undefined},
  processEnv: NodeJS.ProcessEnv,
): {[variable: string]: string | undefined} {
  const inlinableProcessEnv = pickBy(processEnv, (value, key) => EsbuildEnvVarRegex.test(key) && value)

  return {...appEnv, ...inlinableProcessEnv}
}

/**
 * Builds the esbuild `define` map that inlines environment variables as `process.env.*` references.
 *
 * @param env - The environment variables to inline.
 * @returns The esbuild `define` map.
 */
export function esbuildDefine(env: {[variable: string]: string | undefined}): {[key: string]: string} {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]))
}
