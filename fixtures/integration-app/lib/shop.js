import {graphqlRequest} from '@shopify/app/api'

export async function getShopName() {
  const {
    data: {
      shop: {name},
    },
  } = await graphqlRequest(`
    query {
      shop {
        name
      }
    }
  `)
  return `berlin-${name}`
}
