/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-redundant-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type BulkOperationRunQueryMutationVariables = Types.Exact<{
  query: Types.Scalars['String']['input']
}>

export type BulkOperationRunQueryMutation = {
  bulkOperationRunQuery?: {
    bulkOperation?: {
      id: string
      status: Types.BulkOperationStatus
      errorCode?: Types.BulkOperationErrorCode | null
      createdAt: unknown
      objectCount: unknown
      fileSize?: unknown | null
      url?: string | null
    } | null
    userErrors: {field?: string[] | null; message: string}[]
  } | null
}

export const BulkOperationRunQuery = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'BulkOperationRunQuery'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'query'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'bulkOperationRunQuery'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'query'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'query'}},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'status'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'errorCode'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'objectCount'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'fileSize'}},
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
} as unknown as DocumentNode<BulkOperationRunQueryMutation, BulkOperationRunQueryMutationVariables>
