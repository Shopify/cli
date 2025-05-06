/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateAssetUrlMutationVariables = Types.Exact<{
  sourceExtension: Types.SourceExtension
}>

export type CreateAssetUrlMutation = {
  appRequestSourceUploadUrl: {
    sourceUploadUrl?: string | null
    userErrors: {field?: string[] | null; message: string}[]
  }
}

export const CreateAssetUrl = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CreateAssetURL'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'sourceExtension'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'SourceExtension'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appRequestSourceUploadUrl'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'sourceExtension'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'sourceExtension'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'sourceUploadUrl'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
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
} as unknown as DocumentNode<CreateAssetUrlMutation, CreateAssetUrlMutationVariables>
