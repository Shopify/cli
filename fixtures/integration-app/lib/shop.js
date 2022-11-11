import {adminGraphQLFetch} from '@shopify/app/api'

export async function getShopName() {
  const {
    data: {
      shop: {name},
    },
  } = await adminGraphQLFetch(`
    query {
      shop {
        name
      }
    }
  `)
  return `berlin-${name}`
}
