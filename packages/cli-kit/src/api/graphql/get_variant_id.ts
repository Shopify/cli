import {gql} from 'graphql-request'

export const FindProductVariantQuery = gql`
  query {
    products(first: 1) {
      edges {
        node {
          id
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`

export interface FindProductVariantSchema {
  products: {
    edges: {
      node: {
        id: string
        variants: {
          edges: {
            node: {
              id: string
            }
          }[]
        }
      }
    }[]
  }
}
