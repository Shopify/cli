/**
 * Bounded plain-JSON preflight.
 *
 * Every result-contract entry point accepts `unknown` and hands it to Zod. Zod
 * walks whatever it is given, so a cyclic graph, a class instance with getters,
 * or a pathologically deep structure has to be rejected before schema parsing
 * starts. This module lives apart from `schema.ts` so `scope.ts` and `schema.ts`
 * can both depend on it without an import cycle.
 */

export const MAX_APP_DOCTOR_JSON_DEPTH = 100
export const MAX_APP_DOCTOR_JSON_NODES = 500_000

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

interface JsonWalk {
  nodes: number
  ancestors: Set<object>
}

function isBoundedJsonNode(value: unknown, depth: number, walk: JsonWalk): boolean {
  walk.nodes += 1
  if (walk.nodes > MAX_APP_DOCTOR_JSON_NODES || depth > MAX_APP_DOCTOR_JSON_DEPTH) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (walk.ancestors.has(value)) return false
  if (!Array.isArray(value) && !isPlainObject(value)) return false

  walk.ancestors.add(value)
  const children = Array.isArray(value) ? value : Object.values(value)
  const bounded = children.every((child) => isBoundedJsonNode(child, depth + 1, walk))
  walk.ancestors.delete(value)
  return bounded
}

/**
 * True when `value` is made only of finite JSON scalars, arrays, and plain
 * objects, contains no cycles, and stays within the depth and node limits.
 * `undefined` anywhere (including as an object property value) is rejected
 * because it is not representable in JSON.
 */
export function isBoundedJson(value: unknown): boolean {
  return isBoundedJsonNode(value, 0, {nodes: 0, ancestors: new Set()})
}
