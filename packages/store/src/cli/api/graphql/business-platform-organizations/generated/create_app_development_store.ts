/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateAppDevelopmentStoreMutationVariables = Types.Exact<{
  shopName: Types.Scalars['String']['input']
  priceLookupKey: Types.Scalars['String']['input']
  prepopulateTestData?: Types.InputMaybe<Types.Scalars['Boolean']['input']>
}>

export type CreateAppDevelopmentStoreMutation = {
  createAppDevelopmentStore: {
    shopAdminUrl?: string | null
    shopDomain?: string | null
    userErrors?: {code?: string | null; field: string[]; message: string}[] | null
  }
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
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'shopName'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'priceLookupKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'prepopulateTestData'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'Boolean'}},
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
                name: {kind: 'Name', value: 'shopName'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'shopName'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'priceLookupKey'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'priceLookupKey'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'prepopulateTestData'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'prepopulateTestData'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'shopAdminUrl'}},
                {kind: 'Field', name: {kind: 'Name', value: 'shopDomain'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'code'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'field'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
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
} as unknown as DocumentNode<CreateAppDevelopmentStoreMutation, CreateAppDevelopmentStoreMutationVariables>
