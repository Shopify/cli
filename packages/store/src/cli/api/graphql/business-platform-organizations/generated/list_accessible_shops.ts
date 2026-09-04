/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListAccessibleShopsQueryVariables = Types.Exact<{
  first: Types.Scalars['Int']['input']
  filters?: Types.InputMaybe<Types.ShopFilterInput[] | Types.ShopFilterInput>
  search?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type ListAccessibleShopsQuery = {
  organization?: {
    id: string
    name: string
    accessibleShops?: {
      edges: {
        node: {
          id: string
          shopifyShopId?: string | null
          name: string
          storeType?: Types.Store | null
          planName?: string | null
          primaryDomain?: string | null
          url?: string | null
          createdAt: unknown
        }
      }[]
      pageInfo: {hasNextPage: boolean}
    } | null
  } | null
}

export const ListAccessibleShops = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ListAccessibleShops'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'first'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'filters'}},
          type: {
            kind: 'ListType',
            type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ShopFilterInput'}}},
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'search'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'organization'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'accessibleShops'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'first'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'first'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'sort'},
                      value: {kind: 'EnumValue', value: 'SHOP_CREATED_AT_DESC'},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'filters'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'filters'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'search'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'search'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'edges'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'node'},
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'shopifyShopId'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'storeType'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'planName'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'primaryDomain'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'url'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                                  {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                ],
                              },
                            },
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'pageInfo'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ListAccessibleShopsQuery, ListAccessibleShopsQueryVariables>
