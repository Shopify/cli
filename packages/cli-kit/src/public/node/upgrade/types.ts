import {defineJsonOutputSchema, type InferJsonOutputSchema} from '../json-output-schema.js'
import {isAbsolutePath} from '../path.js'
import {zod} from '../schema.js'
// eslint-disable-next-line no-restricted-imports -- JSON filesystem paths use native platform separators.
import {resolve} from 'node:path'

export const upgradeJsonOutputSchema = defineJsonOutputSchema({
  name: 'UpgradeResult',
  schema: zod.union([
    zod
      .object({
        status: zod.literal('success'),
        changed: zod.boolean().describe('Whether the verified installed version differs from previousVersion.'),
        scope: zod.literal('global'),
        previousVersion: zod.string().min(1),
        version: zod.string().min(1),
        packageManager: zod.enum(['npm', 'pnpm', 'yarn', 'bun', 'homebrew']),
      })
      .strict(),
    zod
      .object({
        status: zod.literal('success'),
        changed: zod.null().describe('Null because local dependency changes and installed versions are not verified.'),
        scope: zod.literal('local'),
        directory: zod
          .string()
          .refine(isAbsolutePath, 'Must be an absolute filesystem path.')
          .transform((directory) => resolve(directory)),
        previousVersion: zod.string().min(1),
        availableVersion: zod
          .string()
          .min(1)
          .nullable()
          .describe('The available registry version, or null when unknown.'),
        packages: zod.array(zod.string().min(1)),
      })
      .strict(),
    zod
      .object({
        status: zod.literal('skipped'),
        reason: zod.enum(['development', 'local-autoupgrade', 'dependency-not-found']),
        scope: zod.enum(['global', 'local']),
      })
      .strict(),
  ]),
})

export type UpgradeResult = InferJsonOutputSchema<typeof upgradeJsonOutputSchema>
