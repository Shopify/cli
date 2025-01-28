/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ThemeFilesDeleteMutationVariables = Types.Exact<{
  themeId: Types.Scalars['ID']['input']
  files: Types.Scalars['String']['input'][] | Types.Scalars['String']['input']
}>

export type ThemeFilesDeleteMutation = {
  themeFilesDelete?: {
    deletedThemeFiles?: {filename: string}[] | null
    userErrors: {
      filename?: string | null
      code?: Types.OnlineStoreThemeFilesUserErrorsCode | null
      message: string
    }[]
  } | null
}

export const ThemeFilesDelete = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'themeFilesDelete'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'themeId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'files'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'themeFilesDelete'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'themeId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'themeId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'files'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'files'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'deletedThemeFiles'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'filename'}},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'filename'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'code'}},
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
} as unknown as DocumentNode<ThemeFilesDeleteMutation, ThemeFilesDeleteMutationVariables>
