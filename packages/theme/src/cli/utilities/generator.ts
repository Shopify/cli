import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

export const BLOCK_TYPES = ['basic']
export const SECTION_TYPES = ['basic']
export const TEMPLATE_TYPES = ['basic']

export const FILE_TYPES = ['liquid', 'json']

export const TEMPLATE_RESOURCE_TYPES = [
  '404',
  'article',
  'blog',
  'cart',
  'collection',
  'customers',
  'gift_card',
  'list-collections',
  'page',
  'password',
  'product',
  'robots',
  'search',
]

export type BlockType = (typeof BLOCK_TYPES)[number]
export type SectionType = (typeof SECTION_TYPES)[number]
export type TemplateResourceType = (typeof TEMPLATE_RESOURCE_TYPES)[number]
export type TemplateType = (typeof TEMPLATE_TYPES)[number]
export type FileType = (typeof FILE_TYPES)[number]

export async function promptForType<T extends string>(message: string, types: ReadonlyArray<T>): Promise<T> {
  const choices = types.map((type) => ({label: type, value: type}))
  const result = await renderSelectPrompt({
    message,
    choices,
  })
  return result
}
