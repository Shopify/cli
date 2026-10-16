/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type HistoricalLogsQueryVariables = Types.Exact<{
  clientId: Types.Scalars['String']['input']
  types: Types.LogEventType[] | Types.LogEventType
  timestamp: Types.TimestampRangeInput
  limit: Types.Scalars['Int']['input']
  filters?: Types.InputMaybe<Types.LogFilterInput[] | Types.LogFilterInput>
  sortKey?: Types.InputMaybe<Types.LogSortKeys>
  reverse?: Types.InputMaybe<Types.Scalars['Boolean']['input']>
}>

export type HistoricalLogsQuery = {
  app?: {logs?: {records: ({json: JsonMapType} | {json: JsonMapType})[]} | null} | null
}

export const HistoricalLogs = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'HistoricalLogs'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'clientId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'types'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'LogEventType'}}},
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'timestamp'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'TimestampRangeInput'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'limit'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'Int'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'filters'}},
          type: {
            kind: 'ListType',
            type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'LogFilterInput'}}},
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'sortKey'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'LogSortKeys'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'reverse'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'Boolean'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'app'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'clientId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'clientId'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'logs'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'types'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'types'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'timestamp'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'timestamp'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'limit'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'limit'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'filters'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'filters'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'sortKey'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'sortKey'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'reverse'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'reverse'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'records'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'json'}},
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
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
} as unknown as DocumentNode<HistoricalLogsQuery, HistoricalLogsQueryVariables>
