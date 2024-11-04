/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AppVersionsQueryVariables = Types.Exact<{
  appId: Types.Scalars['ID']['input']
}>

export type AppVersionsQuery = {
  app: {id: string; activeRelease: {id: string; version: {id: string}}}
  versions: {
    id: string
    createdAt: string
    createdBy?: string | null
    metadata: {message?: string | null; versionTag?: string | null}
  }[]
}

export const AppVersions = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'AppVersions'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
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
                name: {kind: 'Name', value: 'id'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'activeRelease'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'version'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'id'}},
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
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'versions'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {kind: 'Field', name: {kind: 'Name', value: 'createdAt'}},
                {kind: 'Field', name: {kind: 'Name', value: 'createdBy'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'metadata'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'versionTag'}},
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
} as unknown as DocumentNode<AppVersionsQuery, AppVersionsQueryVariables>
