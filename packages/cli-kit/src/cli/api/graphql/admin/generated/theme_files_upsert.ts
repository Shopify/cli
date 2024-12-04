/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ThemeFilesUpsertMutationVariables = Types.Exact<{
  files: Types.OnlineStoreThemeFilesUpsertFileInput[] | Types.OnlineStoreThemeFilesUpsertFileInput
  themeId: Types.Scalars['ID']['input']
}>

export type ThemeFilesUpsertMutation = {
  themeFilesUpsert?: {
    upsertedThemeFiles?: {filename: string}[] | null
    userErrors: {filename?: string | null; message: string}[]
  } | null
}

export const ThemeFilesUpsert = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'themeFilesUpsert'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'files'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: {kind: 'NamedType', name: {kind: 'Name', value: 'OnlineStoreThemeFilesUpsertFileInput'}},
              },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'themeId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'themeFilesUpsert'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'files'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'files'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'themeId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'themeId'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'upsertedThemeFiles'},
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
} as unknown as DocumentNode<ThemeFilesUpsertMutation, ThemeFilesUpsertMutationVariables>
