import {defineJsonOutputSchema, type InferJsonOutputSchema} from '../json-output-schema.js'
import {zod} from '../schema.js'

export const upgradeJsonOutputSchema = defineJsonOutputSchema({
  name: 'UpgradeResult',
  schema: zod.discriminatedUnion('status', [
    zod.object({
      status: zod.literal('upgraded'),
      scope: zod.literal('global'),
      previousVersion: zod.string(),
      version: zod.string(),
      packageManager: zod.string(),
    }),
    zod.object({
      status: zod.literal('dependencies_updated'),
      scope: zod.literal('local'),
      directory: zod.string(),
      previousVersion: zod.string(),
      availableVersion: zod.string().optional(),
      packages: zod.array(zod.string()),
    }),
    zod.object({
      status: zod.literal('skipped'),
      reason: zod.enum(['development', 'local_autoupgrade', 'dependency_not_found']),
      scope: zod.enum(['global', 'local']),
    }),
  ]),
})

export type UpgradeResult = InferJsonOutputSchema<typeof upgradeJsonOutputSchema>
