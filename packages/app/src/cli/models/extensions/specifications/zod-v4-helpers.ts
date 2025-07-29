// Import zod from the re-exported location
import {zod as z} from '@shopify/cli-kit/node/schema'

/**
 * Helper to create a string schema with custom error messages
 * Zod v4 uses a different approach than v3 for custom messages
 */
export function zodString(options?: {required?: string; invalid?: string}) {
  let schema = z.string()

  if (options?.required) {
    schema = schema.min(1, options.required)
  }

  return schema
}

/**
 * Helper to create a boolean schema with custom error messages
 */
export function zodBoolean(options?: {required?: string; invalid?: string}) {
  return z.boolean()
}

/**
 * Helper to create an array schema with custom error messages
 */
export function zodArray<T>(itemSchema: z.ZodType<T>, options?: {required?: string; invalid?: string}) {
  return z.array(itemSchema)
}
