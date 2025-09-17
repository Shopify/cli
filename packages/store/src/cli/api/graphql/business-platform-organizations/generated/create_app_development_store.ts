/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateAppDevelopmentStoreMutationVariables = Types.Exact<{
  developerPreviewHandle: Types.Scalars['String']['input']
  prepopulateTestData: Types.Scalars['Boolean']['input']
  priceLookupKey: Types.Scalars['String']['input']
  shopName: Types.Scalars['String']['input']
}>

export type CreateAppDevelopmentStoreMutation = {
  createAppDevelopmentStore: {shopAdminUrl?: string | null; shopDomain?: string | null}
}

export const CreateAppDevelopmentStore = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CreateAppDevelopmentStore'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'developerPreviewHandle'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'prepopulateTestData'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Boolean'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'priceLookupKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'shopName'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'createAppDevelopmentStore'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'developerPreviewHandle'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'developerPreviewHandle'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'prepopulateTestData'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'prepopulateTestData'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'priceLookupKey'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'priceLookupKey'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'shopName'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'shopName'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'shopAdminUrl'}},
                {kind: 'Field', name: {kind: 'Name', value: 'shopDomain'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CreateAppDevelopmentStoreMutation, CreateAppDevelopmentStoreMutationVariables>
