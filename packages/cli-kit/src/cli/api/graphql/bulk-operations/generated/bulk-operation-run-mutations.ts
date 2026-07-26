/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type BulkOperationRunMutationsMutationVariables = Types.Exact<{
  operations: Types.BulkMutationOperationInput[] | Types.BulkMutationOperationInput
}>

export type BulkOperationRunMutationsMutation = {
  bulkOperationRunMutations?: {
    bulkOperation?: {
      type: Types.BulkOperationType
      completedAt?: unknown | null
      createdAt: unknown
      errorCode?: Types.BulkOperationErrorCode | null
      id: string
      objectCount: unknown
      partialDataUrl?: string | null
      status: Types.BulkOperationStatus
      url?: string | null
    } | null
    userErrors: {
      code?: Types.BulkOperationRunMutationsUserErrorCode | null
      field?: string[] | null
      message: string
    }[]
  } | null
}

export const BulkOperationRunMutations = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'BulkOperationRunMutations'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'operations'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: {kind: 'NamedType', name: {kind: 'Name', value: 'BulkMutationOperationInput'}},
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'bulkOperationRunMutations'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'operations'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'operations'}},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'type'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'completedAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'errorCode'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'objectCount'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'partialDataUrl'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'status'}},
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
} as unknown as DocumentNode<BulkOperationRunMutationsMutation, BulkOperationRunMutationsMutationVariables>
