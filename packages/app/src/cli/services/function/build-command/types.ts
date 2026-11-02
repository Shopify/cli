import {functionAbsolutePathSchema, functionIdentitySchema} from '../types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const functionBuildSchema = functionIdentitySchema
  .extend({
    wasmPath: functionAbsolutePathSchema
      .nullable()
      .describe('The built Wasm file, or null when the build produced no file.'),
  })
  .strict()

export const functionBuildJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionBuildResult',
  schema: zod.object({status: zod.literal('success'), function: functionBuildSchema}).strict(),
  definitions: {FunctionBuild: functionBuildSchema},
})

export type FunctionBuildResult = InferJsonOutputSchema<typeof functionBuildJsonOutputSchema>
