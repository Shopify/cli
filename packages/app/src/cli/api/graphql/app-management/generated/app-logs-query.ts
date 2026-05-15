/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AppLogsQueryVariables = Types.Exact<{
  apiKey: Types.Scalars['String']['input']
  startTime: Types.Scalars['DateTime']['input']
  endTime: Types.Scalars['DateTime']['input']
  types?: Types.InputMaybe<Types.Scalars['String']['input'][] | Types.Scalars['String']['input']>
  status?: Types.InputMaybe<Types.Scalars['String']['input']>
  target?: Types.InputMaybe<Types.Scalars['String']['input']>
  shopIds?: Types.InputMaybe<Types.Scalars['Int']['input'][] | Types.Scalars['Int']['input']>
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>
  after?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export interface AppLogNode {
  id: string
  timestamp: string
  type: string
  status: string | null
  target: string | null
  shopDomain: string | null
  executionDurationMs: number | null
  payload: Record<string, unknown> | null
}

export interface AppLogEdge {
  node: AppLogNode
  cursor: string
}

export interface AppLogsQueryResult {
  appLogs: {
    edges: AppLogEdge[]
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
  }
}

export const AppLogsQuery = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'AppLogsQuery'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'startTime'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'DateTime'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'endTime'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'DateTime'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'types'}},
          type: {
            kind: 'ListType',
            type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'AppLogEventType'}}},
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'status'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'AppLogStatus'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'target'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'shopIds'}},
          type: {
            kind: 'ListType',
            type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}}},
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'first'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appLogs'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'apiKey'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'startTime'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'startTime'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'endTime'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'endTime'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'types'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'types'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'status'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'status'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'target'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'target'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'shopIds'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'shopIds'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'first'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'first'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'after'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'edges'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'node'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'timestamp'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'type'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'status'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'target'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'shopDomain'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'executionDurationMs'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'payload'}},
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
                      {kind: 'Field', name: {kind: 'Name', value: 'cursor'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'pageInfo'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'endCursor'}},
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
} as unknown as DocumentNode<AppLogsQueryResult, AppLogsQueryVariables>
