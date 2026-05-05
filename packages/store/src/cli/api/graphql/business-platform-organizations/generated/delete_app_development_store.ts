/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type DeleteAppDevelopmentStoreMutationVariables = Types.Exact<{
  storeFqdn: Types.Scalars['String']['input']
}>

export type DeleteAppDevelopmentStoreMutation = {
  deleteAppDevelopmentStore?: {
    success: boolean
    userErrors: {code?: string | null; field: string[]; message: string}[]
  } | null
}

export const DeleteAppDevelopmentStore = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'DeleteAppDevelopmentStore'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'storeFqdn'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'deleteAppDevelopmentStore'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'storeFqdn'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'storeFqdn'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'success'}},
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
} as unknown as DocumentNode<DeleteAppDevelopmentStoreMutation, DeleteAppDevelopmentStoreMutationVariables>
