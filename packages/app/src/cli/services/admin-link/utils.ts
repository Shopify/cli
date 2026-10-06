import {hyphenate} from '@shopify/cli-kit/common/string'

export const contextToTarget = (context: string) => {
  const splitContext = context.split('#')
  if (splitContext.length !== 2 || splitContext.some((part) => part === '' || part === undefined)) {
    throw new Error('Invalid context')
  }
  const domain = 'admin'
  const subDomain = typeToSubDomain(splitContext[0] ?? '')
  const entity = locationToEntity(splitContext[1] ?? '')
  const action = 'link'

  if (entity === 'selection') {
    return [domain, `${subDomain}-index`, `${entity}-action`, action].join('.')
  } else {
    return [domain, `${subDomain}-${entity}`, 'action', action].join('.')
  }
}

type AdminLinkEntity = 'details' | 'index' | 'selection' | 'fulfilled-card'

const LOCATION_TO_ENTITY = new Map<string, AdminLinkEntity>([
  ['show', 'details'],
  ['index', 'index'],
  ['action', 'selection'],
  ['fulfilled_card', 'fulfilled-card'],
])

const TYPE_TO_SUB_DOMAIN = new Map<string, string>([['variants', 'product-variant']])

const locationToEntity = (location: string): AdminLinkEntity => {
  const entity = LOCATION_TO_ENTITY.get(location.toLocaleLowerCase())
  if (!entity) throw new Error(`Invalid context location: ${location}`)
  return entity
}

const typeToSubDomain = (type: string): string => {
  const normalizedType = type.toLocaleLowerCase()
  return TYPE_TO_SUB_DOMAIN.get(normalizedType) ?? hyphenate(normalizedType.replace(new RegExp(`(s)$`), ''))
}
