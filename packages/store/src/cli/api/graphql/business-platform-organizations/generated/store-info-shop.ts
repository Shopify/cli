/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type StoreInfoShopQueryVariables = Types.Exact<{
  search?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type StoreInfoShopQuery = {
  organization?: {
    accessibleShops?: {
      edges: {
        node: {
          shopifyShopId?: string | null
          name: string
          primaryDomain?: string | null
          storeType?: Types.Store | null
          developerPreviewHandle?: string | null
          planName?: string | null
          ownerDetails?: {fullName?: string | null; email?: string | null} | null
        }
      }[]
    } | null
  } | null
}

export const StoreInfoShop = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'StoreInfoShop'},
      variableDefinitions: [
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
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'accessibleShops'},
                  arguments: [
                    {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '5'}},
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
                                  {kind: 'Field', name: {kind: 'Name', value: 'shopifyShopId'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'primaryDomain'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'storeType'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'developerPreviewHandle'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'planName'}},
                                  {
                                    kind: 'Field',
                                    name: {kind: 'Name', value: 'ownerDetails'},
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {kind: 'Field', name: {kind: 'Name', value: 'fullName'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'email'}},
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
} as unknown as DocumentNode<StoreInfoShopQuery, StoreInfoShopQueryVariables>
