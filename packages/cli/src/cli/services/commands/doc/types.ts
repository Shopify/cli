import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const DocumentSchema = zod
  .object({
    url: zod.string().url().describe('The requested shopify.dev document URL.'),
    content: zod.string().describe('The document in Markdown, with the requested language filter applied.'),
  })
  .strict()

const DocumentFileSchema = zod
  .object({
    path: zod
      .string()
      .regex(/^(?:\/|[A-Za-z]:[\\/]|\\\\)/)
      .describe('The absolute native path of the written file.'),
    format: zod.literal('markdown').describe('The file contains the original Markdown document, not a JSON wrapper.'),
  })
  .strict()

export const docFetchJsonOutputSchema = defineJsonOutputSchema({
  name: 'DocFetchResult',
  schema: zod.union([zod.object({document: DocumentSchema}).strict(), DocumentFileSchema]),
  definitions: {Document: DocumentSchema, DocumentFile: DocumentFileSchema},
})

export type DocFetchResult = InferJsonOutputSchema<typeof docFetchJsonOutputSchema>
export type DocFetchDocument = Extract<DocFetchResult, {document: unknown}>
