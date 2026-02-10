/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-redundant-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListBulkOperationsQueryVariables = Types.Exact<{
  query?: Types.InputMaybe<Types.Scalars['String']['input']>
  first: Types.Scalars['Int']['input']
  sortKey: Types.BulkOperationsSortKeys
}>

export type ListBulkOperationsQuery = {
  bulkOperations: {
    nodes: {
      id: string
      status: Types.BulkOperationStatus
      errorCode?: Types.BulkOperationErrorCode | null
      objectCount: unknown
      createdAt: unknown
      completedAt?: unknown | null
      url?: string | null
      partialDataUrl?: string | null
    }[]
  }
}

export const ListBulkOperations = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ListBulkOperations'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'query'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'first'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'sortKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'BulkOperationsSortKeys'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'bulkOperations'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'first'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'first'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'query'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'query'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'sortKey'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'sortKey'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'nodes'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'status'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'errorCode'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'objectCount'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'completedAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'url'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'partialDataUrl'}},
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
} as unknown as DocumentNode<ListBulkOperationsQuery, ListBulkOperationsQueryVariables>
