/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type OrganizationShopStatusQueryQueryVariables = Types.Exact<{
  shopDomain: Types.Scalars['String']['input']
}>

export type OrganizationShopStatusQueryQuery = {
  organization?: {
    __typename: 'Organization'
    id: string
    storeCreation?: {__typename: 'StoreCreation'; status: Types.StoreCreationStatus} | null
  } | null
}

export const OrganizationShopStatusQuery = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'OrganizationShopStatusQuery'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'shopDomain'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
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
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'storeCreation'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'shopDomain'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'shopDomain'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'status'}},
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
} as unknown as DocumentNode<OrganizationShopStatusQueryQuery, OrganizationShopStatusQueryQueryVariables>
