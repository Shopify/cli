/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type UpsertThemeFileBodiesMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input']
  files: Types.OnlineStoreThemeFilesUpsertFileInput[] | Types.OnlineStoreThemeFilesUpsertFileInput
}>

export type UpsertThemeFileBodiesMutation = {
  themeFilesUpsert?: {
    job?: {id: string} | null
    upsertedThemeFiles?: {filename: string}[] | null
    userErrors: {
      code?: Types.OnlineStoreThemeFilesUserErrorsCode | null
      filename?: string | null
      message: string
    }[]
  } | null
}

export const UpsertThemeFileBodies = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'upsertThemeFileBodies'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
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
                name: {kind: 'Name', value: 'themeId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
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
                  name: {kind: 'Name', value: 'job'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
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
                      {kind: 'Field', name: {kind: 'Name', value: 'code'}},
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
} as unknown as DocumentNode<UpsertThemeFileBodiesMutation, UpsertThemeFileBodiesMutationVariables>
