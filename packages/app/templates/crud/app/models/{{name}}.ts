import {ApiVersion} from '@shopify/shopify-api'
import {gql, graphql, notNull} from '../utils'
import {MetafieldReference, MetafieldValidation} from './metafield'

interface QueryVariables {
  [key: string]: any
}

export interface GraphQLQueryOptions {
  variables?: QueryVariables
  apiVersion?: ApiVersion
  headers?: {
    [key: string]: any
  }
  tries?: number
}

export type GraphQLClient = (query: string, options?: GraphQLQueryOptions) => Promise<Response>

const FetchMetaobjectListQuery = gql`
  query FetchMetaobjectList($type: String!) {
    metaobjects(type: $type, first: 10) {
      edges {
        node {
          handle
          displayName
          fields {
            key
            value
          }
        }
      }
    }
  }
`

interface FetchMetaobjectListResponse {
  metaobjects?: {
    edges: ({node?: MetaobjectListItem} | null)[]
  } | null
}

export interface MetaobjectListItem<> {
  handle: string
  displayName: string
}

export async function fetchMetaobjectList(graphql: GraphQLClient, type: string): Promise<MetaobjectListItem[]> {
  const response = await graphql(FetchMetaobjectListQuery, {variables: {type}})
  const {data} = await response.json()
  return (data as FetchMetaobjectListResponse)?.metaobjects?.edges.map((edge) => edge?.node).filter(notNull) || []
}

const FetchMetaobjectByHandleQuery = gql`
  query FetchMetaobjectByHandle($handleInput: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handleInput) {
      id
      handle
      fields {
        key
        value
        type
        reference {
          ... on Product {
            id
            title
            images(first: 1) {
              nodes {
                url
              }
            }
          }
        }
        references(first: 10) {
          nodes {
            ... on Product {
              id
              title
              images(first: 1) {
                nodes {
                  url
                }
              }
            }
          }
        }
        definition {
          key
          name
          type {
            name
          }
          required
          description
          validations {
            value
            name
            type
          }
        }
      }
    }
  }
`

interface MetaobjectFieldDefinition {
  name: string
  key: string
  required: boolean
  description: string
  type: {name: string}
  validations: MetafieldValidation[]
}

export interface MetaobjectField {
  key: string
  value: string
  type: string
  reference?: null | MetafieldReference
  references?: null | {
    nodes: (MetafieldReference | null)[]
  }
  definition: MetaobjectFieldDefinition
}

export interface MetaobjectDefinition {
  fieldDefinitions: MetaobjectFieldDefinition[]
}

export interface Metaobject {
  id: string
  handle: string
  fields: MetaobjectField[]
}

interface FetchMetaobjectByHandleResponse {
  metaobjectByHandle?: Metaobject | null
}

export async function fetchMetaobjectByHandle(handleInput: {type: string; handle: string}) {
  const {data} = await graphql<FetchMetaobjectByHandleResponse>(FetchMetaobjectByHandleQuery, {handleInput})
  return data?.metaobjectByHandle ?? undefined
}

const FetchMetaobjectDefinitionQuery = gql`
  query FetchMetaobjectDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      fieldDefinitions {
        key
        name
        type {
          name
        }
        required
        description
        validations {
          value
          name
          type
        }
      }
    }
  }
`

interface FetchMetaobjectDefinitionResponse {
  metaobjectDefinitionByType?: MetaobjectDefinition | null
}

export async function fetchMetaobjectDefinition(type: string) {
  const {data} = await graphql<FetchMetaobjectDefinitionResponse>(FetchMetaobjectDefinitionQuery, {type})
  return data?.metaobjectDefinitionByType ?? undefined
}
