/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type LogAppQueryVariables = Types.Exact<{
  clientId: Types.Scalars['String']['input']
}>

export type LogAppQuery = {app: {key: string; organizationId: string}}

export const LogApp = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'LogApp'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'clientId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: {kind: 'Name', value: 'app'},
            name: {kind: 'Name', value: 'appByKey'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'key'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'clientId'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'key'}},
                {kind: 'Field', name: {kind: 'Name', value: 'organizationId'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<LogAppQuery, LogAppQueryVariables>
