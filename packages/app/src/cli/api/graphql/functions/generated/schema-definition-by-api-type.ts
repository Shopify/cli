/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type SchemaDefinitionByApiTypeQueryVariables = Types.Exact<{
  type: Types.Scalars['String']['input']
  version: Types.Scalars['String']['input']
}>

export type SchemaDefinitionByApiTypeQuery = {api?: {schema?: {definition: string} | null} | null}

export const SchemaDefinitionByApiType = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'SchemaDefinitionByApiType'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'type'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'version'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'api'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'type'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'type'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'schema'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'version'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'version'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'definition'}},
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
} as unknown as DocumentNode<SchemaDefinitionByApiTypeQuery, SchemaDefinitionByApiTypeQueryVariables>
