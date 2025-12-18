/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-redundant-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type BulkOperationCancelMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input']
}>

export type BulkOperationCancelMutation = {
  bulkOperationCancel?: {
    bulkOperation?: {
      completedAt?: unknown | null
      createdAt: unknown
      errorCode?: Types.BulkOperationErrorCode | null
      fileSize?: unknown | null
      id: string
      objectCount: unknown
      partialDataUrl?: string | null
      query: string
      rootObjectCount: unknown
      status: Types.BulkOperationStatus
      type: Types.BulkOperationType
      url?: string | null
    } | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

export const BulkOperationCancel = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'BulkOperationCancel'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'bulkOperationCancel'},
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
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'bulkOperation'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'completedAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'errorCode'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'fileSize'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'objectCount'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'partialDataUrl'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'query'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'rootObjectCount'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'status'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'type'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'url'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
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
} as unknown as DocumentNode<BulkOperationCancelMutation, BulkOperationCancelMutationVariables>
