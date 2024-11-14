export const contextToTarget = (context: string) => {
  const splitContext = context.split('#')
  if (splitContext.length !== 2 || splitContext.some((part) => part === '' || part === undefined)) {
    throw new Error('Invalid context')
  }
  const domain = 'admin'
  const subDomain = typeToSubDomain(splitContext[0] || '')
  const entity = locationToEntity(splitContext[1] || '')
  const action = 'link'

  return [domain, subDomain, entity, action].join('.')
}

const locationToEntity = (location: string) => {
  switch (location.toLocaleLowerCase()) {
    case 'show':
      return 'item'
    case 'index':
      return 'index'
    case 'action':
      return 'selection'
    case 'fulfilled_card':
      return 'fulfilled_card'
    default:
      throw new Error(`Invalid context location: ${location}`)
  }
}
const typeToSubDomain = (word: string) => {
  return word.toLocaleLowerCase().replace(new RegExp(`(s)$`), '')
}
