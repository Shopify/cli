import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppSecurityInstructionsDelivery} from './app-security-instructions.js'

/** Shared by `instructions --json` and `check --json`, so an agent reads the instructions the same way from both. */
export const appSecurityInstructionsSchema = zod.object({
  content: zod.string(),
  copied_to_clipboard: zod.boolean(),
  /** The file written by `instructions --write`. */
  path: zod.string().nullable(),
})

export type AppSecurityInstructionsJson = zod.infer<typeof appSecurityInstructionsSchema>

export const securityInstructionsJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityInstructionsResult',
  schema: zod.object({instructions: appSecurityInstructionsSchema}),
  definitions: {AppSecurityInstructions: appSecurityInstructionsSchema},
})

export function toAppSecurityInstructionsJson(delivery: AppSecurityInstructionsDelivery): AppSecurityInstructionsJson {
  return {
    content: delivery.content,
    copied_to_clipboard: delivery.copiedToClipboard,
    path: delivery.writePath ?? null,
  }
}
