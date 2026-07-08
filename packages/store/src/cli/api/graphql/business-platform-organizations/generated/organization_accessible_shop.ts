/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type OrganizationAccessibleShopQueryVariables = Types.Exact<{
  id: Types.Scalars['ShopifyShopID']['input']
}>

export type OrganizationAccessibleShopQuery = {
  organization?: {
    accessibleShop?: {shopifyShopId?: string | null; planName?: string | null; storeType?: Types.Store | null} | null
  } | null
}

export const OrganizationAccessibleShop = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'OrganizationAccessibleShop'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ShopifyShopID'}}},
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
                  name: {kind: 'Name', value: 'accessibleShop'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'id'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'shopifyShopId'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'planName'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'storeType'}},
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
} as unknown as DocumentNode<OrganizationAccessibleShopQuery, OrganizationAccessibleShopQueryVariables>
