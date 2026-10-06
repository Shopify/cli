import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

/** Shared by `instructions --json` and `check --json`, so an agent reads the instructions the same way from both. */
export const appSecurityInstructionsSchema = zod
  .object({
    content: zod.string(),
    copiedToClipboard: zod.boolean(),
    /** The file written by `instructions --write`. */
    path: zod.string().nullable(),
  })
  .strict()

export type AppSecurityInstructionsJson = zod.infer<typeof appSecurityInstructionsSchema>

export const securityInstructionsJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityInstructionsResult',
  schema: zod.object({instructions: appSecurityInstructionsSchema}).strict(),
  definitions: {AppSecurityInstructions: appSecurityInstructionsSchema},
})

/**
 * The instructions as delivered: copied, written to `writePath`, or neither. Build it after the delivery succeeds,
 * so the result never reports a copy or a file that failed.
 */
export function toAppSecurityInstructionsJson(
  content: string,
  delivery: {copy: boolean; writePath?: string},
): AppSecurityInstructionsJson {
  return {content, copiedToClipboard: delivery.copy, path: delivery.writePath ?? null}
}
