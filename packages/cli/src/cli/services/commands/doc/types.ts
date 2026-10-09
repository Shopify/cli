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

export const documentationSearchEntrySchema = zod
  .object({
    score: zod.number().finite().describe('The relevance score returned by shopify.dev.'),
    content: zod.string().describe('The matching documentation chunk.'),
    url: zod.string().url().describe('The URL of the matching document.'),
    title: zod.string().describe('The title of the matching document.'),
    domain: zod.string().nullable().describe('The documentation domain, or null when unavailable.'),
  })
  .strict()

const PageInfoSchema = zod
  .object({
    hasNextPage: zod.boolean().nullable().describe('Whether more results are available, or null when unknown.'),
  })
  .strict()

export const docSearchJsonOutputSchema = defineJsonOutputSchema({
  name: 'DocSearchResult',
  schema: zod
    .object({
      results: zod.array(documentationSearchEntrySchema).describe('The top matching chunks from one search request.'),
      pageInfo: PageInfoSchema,
    })
    .strict(),
  definitions: {DocumentationSearchEntry: documentationSearchEntrySchema, PageInfo: PageInfoSchema},
})

export type DocSearchResult = InferJsonOutputSchema<typeof docSearchJsonOutputSchema>
