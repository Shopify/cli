const {graphqlRequest} = require('@shopify/app/store')

export async function loader() {
  const {
    data: {
      shop: {name, email},
    },
  } = await graphqlRequest(`
  query {
    shop {
      name
      email
    }
  }
  `)
  return {name, email}
}
