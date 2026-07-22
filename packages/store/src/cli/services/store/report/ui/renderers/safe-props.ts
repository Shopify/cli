const BLOCKED_PROPS = new Set(['key', 'ref', 'children', 'style', 'className', 'id'])
const INVISIBLE_COLORS = new Set(['black', '#000', '#000000'])

/** Returns `undefined` for colors that would render invisibly against a typical terminal background. */
export function safeColor(color?: string | null): string | undefined {
  if (color && INVISIBLE_COLORS.has(color)) return undefined
  return color ?? undefined
}

/**
 * Strips React-internal and invisible-color props a model could otherwise use to hide content or
 * clobber the renderer's own element identity. `@json-render/ink` applies the same guard but does
 * not export it, so every renderer that spreads model-controlled props onto an Ink element must
 * route them through this first.
 */
export function safeBoxProps<T extends Record<string, unknown>>(props: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || BLOCKED_PROPS.has(key)) continue
    if (key === 'color' && typeof value === 'string' && INVISIBLE_COLORS.has(value)) continue
    result[key] = value
  }
  return result as Partial<T>
}
