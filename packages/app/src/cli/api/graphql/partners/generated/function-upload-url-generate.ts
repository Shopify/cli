/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type FunctionUploadUrlGenerateMutationVariables = Types.Exact<{[key: string]: never}>

export type FunctionUploadUrlGenerateMutation = {
  functionUploadUrlGenerate?: {
    generatedUrlDetails?: {url: string; moduleId: string; headers: unknown; maxBytes: number; maxSize: string} | null
  } | null
}

export const FunctionUploadUrlGenerate = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'functionUploadUrlGenerate'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'functionUploadUrlGenerate'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'generatedUrlDetails'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'url'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'moduleId'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'headers'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'maxBytes'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'maxSize'}},
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
} as unknown as DocumentNode<FunctionUploadUrlGenerateMutation, FunctionUploadUrlGenerateMutationVariables>
