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

const locationToEntity = (location: string) => {
  switch (location.toLocaleLowerCase()) {
    case 'show':
      return 'details'
    case 'index':
      return 'index'
    case 'action':
      return 'selection'
    case 'fulfilled_card':
      return 'fulfilled-card'
    default:
      throw new Error(`Invalid context location: ${location}`)
  }
}
const typeToSubDomain = (type: string) => {
  switch (type.toLocaleLowerCase()) {
    case 'variants':
      return 'product-variant'
    default:
      return hyphenate(type.toLocaleLowerCase().replace(new RegExp(`(s)$`), ''))
  }
}
