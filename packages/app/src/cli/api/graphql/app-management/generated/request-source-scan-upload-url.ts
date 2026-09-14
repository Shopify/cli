/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type RequestSourceScanUploadUrlMutationVariables = Types.Exact<{
  appId: Types.Scalars['ID']['input']
  byteSize: Types.Scalars['Int']['input']
}>

export type RequestSourceScanUploadUrlMutation = {
  appRequestSourceScanUploadUrl: {
    sourceScanUploadUrl?: string | null
    userErrors: {field?: string[] | null; message: string}[]
  }
}

export const RequestSourceScanUploadUrl = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'RequestSourceScanUploadUrl'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'byteSize'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appRequestSourceScanUploadUrl'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'byteSize'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'byteSize'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'sourceScanUploadUrl'}},
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
} as unknown as DocumentNode<RequestSourceScanUploadUrlMutation, RequestSourceScanUploadUrlMutationVariables>
