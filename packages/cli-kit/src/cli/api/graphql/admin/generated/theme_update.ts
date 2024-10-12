/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ThemeUpdateMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input']
  name: Types.Scalars['String']['input']
}>

export type ThemeUpdateMutation = {
  themeUpdate?: {theme?: {id: string; name: string; role: Types.ThemeRole} | null} | null
}

export const ThemeUpdate = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'themeUpdate'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
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
            name: {kind: 'Name', value: 'themeUpdate'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'id'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'input'},
                value: {
                  kind: 'ObjectValue',
                  fields: [
                    {
                      kind: 'ObjectField',
                      name: {kind: 'Name', value: 'name'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'name'}},
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'theme'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'role'}},
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
} as unknown as DocumentNode<ThemeUpdateMutation, ThemeUpdateMutationVariables>
