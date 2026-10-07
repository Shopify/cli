import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {ExtensionUuidsByLocalIdentifier} from '../../models/app/identifiers.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {JsonErrorSchema, jsonErrorOutputSchema} from '@shopify/cli-kit/node/error/schema'
import {zod} from '@shopify/cli-kit/node/schema'

const absolutePathSchema = zod.string().refine(isAbsolutePath, 'Expected an absolute native filesystem path')
const importedExtensionSchema = zod
  .object({
    id: zod.string().uuid().describe('The dashboard extension registration UUID, not a Shopify GID.'),
    name: zod.string(),
    type: zod.string().min(1).describe('The upstream dashboard extension type.'),
    directory: absolutePathSchema.describe('The absolute local extension directory.'),
    configurationPath: absolutePathSchema
      .nullable()
      .describe('The absolute local TOML path, or null when no TOML file exists in a kept directory.'),
    changed: zod.boolean().describe('Whether this import wrote the local extension TOML.'),
  })
  .strict()

const importFailureSchema = zod
  .object({
    extensionId: zod.string().uuid().nullable().describe('The registration UUID, or null for identifier persistence.'),
    error: JsonErrorSchema,
  })
  .strict()

export const importDashboardExtensionsJsonOutputSchema = defineJsonOutputSchema({
  name: 'ImportDashboardExtensionsResult',
  schema: zod
    .object({
      status: zod.enum(['success', 'partial', 'skipped', 'cancelled']),
      reason: zod.enum(['no-extensions', 'directory-selection-cancelled']).nullable(),
      extensions: zod
        .array(importedExtensionSchema)
        .describe('Completed extension imports and kept local directories, in selection order.'),
      errors: zod.array(importFailureSchema).describe('Failed selected imports or identifier persistence.'),
      identifiersUpdated: zod
        .boolean()
        .describe('Whether extension identifiers were persisted to the app environment file.'),
    })
    .strict(),
  definitions: {
    ImportedDashboardExtension: importedExtensionSchema,
    ExtensionImportFailure: importFailureSchema,
    ...jsonErrorOutputSchema.definitions,
  },
})

export type ImportDashboardExtensionsResult = InferJsonOutputSchema<typeof importDashboardExtensionsJsonOutputSchema>

export interface ImportedDashboardExtension {
  extension: ExtensionRegistration
  directory: string
  configurationPath: string | null
  changed: boolean
}

export interface ImportExtensionsResult {
  extensions: ImportedDashboardExtension[]
  extensionUuids: ExtensionUuidsByLocalIdentifier
}

export interface ExtensionImportCompletion {
  extensions: ImportedDashboardExtension[]
  failures: {extension: ExtensionRegistration; error: unknown}[]
}
