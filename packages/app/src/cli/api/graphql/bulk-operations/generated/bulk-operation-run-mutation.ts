/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-redundant-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type BulkOperationRunMutationMutationVariables = Types.Exact<{
  mutation: Types.Scalars['String']['input']
  stagedUploadPath: Types.Scalars['String']['input']
  clientIdentifier?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type BulkOperationRunMutationMutation = {
  bulkOperationRunMutation?: {
    bulkOperation?: {
      completedAt?: unknown | null
      createdAt: unknown
      errorCode?: Types.BulkOperationErrorCode | null
      id: string
      objectCount: unknown
      partialDataUrl?: string | null
      status: Types.BulkOperationStatus
      url?: string | null
    } | null
    userErrors: {code?: Types.BulkMutationErrorCode | null; field?: string[] | null; message: string}[]
  } | null
}

export const BulkOperationRunMutation = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'BulkOperationRunMutation'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'mutation'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'stagedUploadPath'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'clientIdentifier'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'bulkOperationRunMutation'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'mutation'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'mutation'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'stagedUploadPath'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'stagedUploadPath'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'clientIdentifier'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'clientIdentifier'}},
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
} as unknown as DocumentNode<BulkOperationRunMutationMutation, BulkOperationRunMutationMutationVariables>
