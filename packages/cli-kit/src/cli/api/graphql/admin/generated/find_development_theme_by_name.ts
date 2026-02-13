/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type FindDevelopmentThemeByNameQueryVariables = Types.Exact<{
  name: Types.Scalars['String']['input']
}>

export type FindDevelopmentThemeByNameQuery = {
  themes?: {nodes: {id: string; name: string; role: Types.ThemeRole; processing: boolean}[]} | null
}

export const FindDevelopmentThemeByName = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'findDevelopmentThemeByName'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'name'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'themes'},
            arguments: [
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '2'}},
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'names'},
                value: {kind: 'ListValue', values: [{kind: 'Variable', name: {kind: 'Name', value: 'name'}}]},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'roles'},
                value: {kind: 'ListValue', values: [{kind: 'EnumValue', value: 'DEVELOPMENT'}]},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'role'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'processing'}},
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
} as unknown as DocumentNode<FindDevelopmentThemeByNameQuery, FindDevelopmentThemeByNameQueryVariables>
