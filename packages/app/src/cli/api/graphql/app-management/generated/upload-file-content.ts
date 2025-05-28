/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type UploadFileContentMutationVariables = Types.Exact<{
  sourceCode: Types.Scalars['String']['input']
}>

export type UploadFileContentMutation = {appRequestSidekickSchema?: {schema?: string | null} | null}

export const UploadFileContent = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'UploadFileContent'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'sourceCode'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appRequestSidekickSchema'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'sourceCode'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'sourceCode'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'schema'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UploadFileContentMutation, UploadFileContentMutationVariables>
