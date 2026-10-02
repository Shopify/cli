import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const HelpCommandSummarySchema = zod.object({
  id: zod.string(),
  summary: zod.string().optional(),
  hidden: zod.boolean().default(false),
})

const HelpTopicSchema = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
  hidden: zod.boolean().default(false),
})

const HelpArgumentSchema = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
  required: zod.boolean().default(false),
  hidden: zod.boolean().default(false),
  options: zod.array(zod.string()).optional(),
  default: zod.unknown().optional(),
})

const HelpFlagSchema = zod.object({
  name: zod.string(),
  type: zod.enum(['boolean', 'option']),
  char: zod.string().optional(),
  summary: zod.string().optional(),
  description: zod.string().optional(),
  env: zod.string().optional(),
  required: zod.boolean().default(false),
  hidden: zod.boolean().default(false),
  options: zod.array(zod.string()).optional(),
  default: zod.unknown().optional(),
  multiple: zod.boolean().optional(),
  allowNo: zod.boolean().optional(),
  aliases: zod.array(zod.string()).optional(),
  dependsOn: zod.array(zod.string()).optional(),
  exclusive: zod.array(zod.string()).optional(),
  exactlyOne: zod.array(zod.string()).optional(),
})

// Keep the public contract focused on command usage. Hidden aliases and oclif/plugin loader
// metadata are intentionally omitted; JSON support is described by the exposed flags.
const HelpCommandSchema = HelpCommandSummarySchema.extend({
  description: zod.string().optional(),
  aliases: zod.array(zod.string()),
  usage: zod.union([zod.string(), zod.array(zod.string())]).optional(),
  examples: zod
    .array(zod.union([zod.string(), zod.object({description: zod.string(), command: zod.string()})]))
    .optional(),
  strict: zod.boolean().default(true),
  args: zod.record(HelpArgumentSchema),
  flags: zod.record(HelpFlagSchema),
})

const listings = {
  commands: zod.array(HelpCommandSummarySchema),
  topics: zod.array(HelpTopicSchema),
}

export const helpJsonOutputSchema = defineJsonOutputSchema({
  name: 'HelpResult',
  schema: zod.discriminatedUnion('kind', [
    zod.object({kind: zod.literal('root'), ...listings}),
    zod.object({kind: zod.literal('topic'), topic: HelpTopicSchema, ...listings}),
    zod.object({kind: zod.literal('command'), command: HelpCommandSchema, ...listings}),
  ]),
  definitions: {
    HelpCommandSummary: HelpCommandSummarySchema,
    HelpTopic: HelpTopicSchema,
    HelpArgument: HelpArgumentSchema,
    HelpFlag: HelpFlagSchema,
    HelpCommand: HelpCommandSchema,
  },
})

export type HelpResult = InferJsonOutputSchema<typeof helpJsonOutputSchema>
