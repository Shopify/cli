import {graphqlRequest} from '@shopify/app/api'

const response = await graphqlRequest(`
  query {
    shop {
      name
    }
  }
`)

console.log(response)
