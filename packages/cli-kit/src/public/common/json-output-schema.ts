import {z} from 'zod'

/** UTC instants in CLI-owned JSON use whole seconds and the Z timezone marker. */
export const jsonOutputTimestampSchema = z
  .string()
  .datetime({precision: 0})
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  .describe('A UTC ISO 8601 instant with whole seconds and the Z timezone marker.')

/**
 * Formats an instant for CLI-owned JSON, truncating fractional seconds without rounding.
 *
 * @param date - The instant to format.
 * @returns A UTC ISO 8601 timestamp with whole seconds and the Z timezone marker.
 */
export function formatJsonOutputTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
