/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-redundant-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type GetBulkOperationByIdQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input']
}>

export type GetBulkOperationByIdQuery = {
  bulkOperation?: {
    completedAt?: unknown | null
    createdAt: unknown
    errorCode?: Types.BulkOperationErrorCode | null
    id: string
    objectCount: unknown
    status: Types.BulkOperationStatus
    url?: string | null
  } | null
}

export const GetBulkOperationById = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'GetBulkOperationById'},
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
            name: {kind: 'Name', value: 'bulkOperation'},
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
                {kind: 'Field', name: {kind: 'Name', value: 'completedAt'}},
                {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                {kind: 'Field', name: {kind: 'Name', value: 'errorCode'}},
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {kind: 'Field', name: {kind: 'Name', value: 'objectCount'}},
                {kind: 'Field', name: {kind: 'Name', value: 'status'}},
                {kind: 'Field', name: {kind: 'Name', value: 'url'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<GetBulkOperationByIdQuery, GetBulkOperationByIdQueryVariables>
