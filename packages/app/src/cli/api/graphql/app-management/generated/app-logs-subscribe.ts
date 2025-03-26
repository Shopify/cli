/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AppLogsSubscribeMutationVariables = Types.Exact<{
  shopIds: Types.Scalars['Int']['input'][] | Types.Scalars['Int']['input']
  apiKey: Types.Scalars['String']['input']
}>

export type AppLogsSubscribeMutation = {
  appLogsSubscribe?: {jwtToken?: string | null; success?: boolean | null; errors?: string[] | null} | null
}

export const AppLogsSubscribe = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'AppLogsSubscribe'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'shopIds'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}}},
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appLogsSubscribe'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'shopIds'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'shopIds'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'apiKey'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'jwtToken'}},
                {kind: 'Field', name: {kind: 'Name', value: 'success'}},
                {kind: 'Field', name: {kind: 'Name', value: 'errors'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AppLogsSubscribeMutation, AppLogsSubscribeMutationVariables>
