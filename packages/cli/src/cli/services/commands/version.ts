import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const versionJsonOutputSchema = defineJsonOutputSchema({
  name: 'VersionResult',
  schema: zod.string(),
})

export type VersionResult = InferJsonOutputSchema<typeof versionJsonOutputSchema>

export async function versionService(): Promise<VersionResult> {
  return CLI_KIT_VERSION
}
