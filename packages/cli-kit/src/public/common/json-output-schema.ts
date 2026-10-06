import {z} from 'zod'

/** UTC instants in CLI-owned JSON use whole seconds and the Z timezone marker. */
export const jsonOutputTimestampSchema = z
  .string()
  .datetime({precision: 0})
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  .describe('A UTC ISO 8601 instant with whole seconds and the Z timezone marker.')
