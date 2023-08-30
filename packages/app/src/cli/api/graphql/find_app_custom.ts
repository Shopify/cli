import {gql} from 'graphql-request'

export function findAppCustomQuery(fields: string) {
  return gql`
  query FindApp($apiKey: String!) {
    app(apiKey: $apiKey) ${fields}
  }
`
}
