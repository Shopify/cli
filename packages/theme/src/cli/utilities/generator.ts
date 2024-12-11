import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

export const BLOCK_TYPES = ['text', 'image', 'video', 'product', 'collection']
export const SECTION_TYPES = ['featured-collection', 'image-with-text', 'rich-text', 'custom']
export const TEMPLATE_TYPES = ['product', 'collection', 'page', 'blog', 'article', 'custom']

export type BlockType = (typeof BLOCK_TYPES)[number]
export type SectionType = (typeof SECTION_TYPES)[number]
export type TemplateType = (typeof TEMPLATE_TYPES)[number]

export async function promptForType<T extends string>(message: string, types: ReadonlyArray<T>): Promise<T> {
  const choices = types.map((type) => ({label: type, value: type}))
  const result = await renderSelectPrompt({
    message,
    choices,
  })
  return result
}
