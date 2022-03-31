import {schema} from '@shopify/cli-kit'

export const homeTemplateSchema = schema.define.object({
  prompts: schema.define
    .array(
      schema.define
        .object({
          type: schema.define.union([schema.define.literal('input'), schema.define.literal('select')]),
          id: schema.define.string(),
          message: schema.define.string(),
          default: schema.define.string().optional(),
          choices: schema.define.array(schema.define.string()).optional(),
        })
        .transform((prompt) => ({
          ...prompt,
          name: prompt.id,
        })),
    )
    .optional()
    .default([]),
})

export type HomeTemplateSchema = schema.define.infer<typeof homeTemplateSchema>
