import {GeneratedExtension, ExtensionFlavorValue} from '../extension.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const generatedExtensionSchema = zod
  .object({
    name: zod.string().min(1).describe('The name selected for the generated extension.'),
    type: zod.string().min(1).describe('The extension type, such as function, theme, or ui_extension.'),
    template: zod.string().min(1).describe('The identifier of the selected extension template.'),
    flavor: zod.string().nullable().describe('The selected template flavor, or null when the template has no flavors.'),
    directory: zod
      .string()
      .refine(isAbsolutePath, 'Expected an absolute filesystem path.')
      .describe('The absolute native filesystem path of the generated extension directory.'),
  })
  .strict()

export const appGenerateExtensionJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppGenerateExtensionResult',
  schema: zod.object({status: zod.literal('success'), extension: generatedExtensionSchema}).strict(),
  definitions: {GeneratedExtension: generatedExtensionSchema},
})

export type AppGenerateExtensionResult = InferJsonOutputSchema<typeof appGenerateExtensionJsonOutputSchema>

export interface GenerateExtensionResult {
  status: AppGenerateExtensionResult['status']
  extension: GeneratedExtension & {name: string; flavor?: ExtensionFlavorValue}
  packageManager: PackageManager
}
