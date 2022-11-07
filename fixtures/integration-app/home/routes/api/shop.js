const {graphqlRequest} = require('@shopify/app/store')

export async function loader() {
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
  return {name}
}
