import {ExtensionSpecification} from '../../extensions/specification.js'
import {AppSchema} from '../app.js'

/**
 * Extract a spec's portion of the raw app config by picking only the keys
 * the spec declares. Returns a deep copy — mutations to the slice don't
 * affect the original config.
 *
 * @param raw - The full app configuration object (raw from TOML parse)
 * @param spec - The extension specification declaring which keys to pick
 * @returns A deep-copied object containing only the spec's declared keys that are present in raw
 */
export function sliceConfigForSpec(raw: object, spec: ExtensionSpecification): object {
  const result: Record<string, unknown> = {}
  const rawRecord = raw as Record<string, unknown>
  for (const key of spec.declaredKeys) {
    if (key in rawRecord) {
      result[key] = structuredClone(rawRecord[key])
    }
  }
  return result
}

/**
 * Find keys in the raw config that aren't claimed by any spec or by the base AppSchema.
 * These are "unsupported sections" that the CLI doesn't recognize.
 *
 * @param raw - The full app configuration object
 * @param claimedKeyArrays - Array of key arrays, one per spec (from Object.keys(slice))
 * @returns Array of unclaimed key names
 */
export function findUnclaimedKeys(raw: object, claimedKeyArrays: string[][]): string[] {
  const claimed = new Set([...Object.keys(AppSchema.shape), 'organization_id', ...claimedKeyArrays.flat()])
  return Object.keys(raw).filter((key) => !claimed.has(key))
}
