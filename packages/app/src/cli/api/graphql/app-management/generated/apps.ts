/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListAppsQueryVariables = Types.Exact<{
  query?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type ListAppsQuery = {
  appsConnection?: {
    edges: {node: {id: string; key: string; activeRelease: {id: string; version: {name: string}}}}[]
    pageInfo: {hasNextPage: boolean}
  } | null
}

export const ListApps = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'listApps'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'query'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appsConnection'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'query'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'query'}},
              },
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '50'}},
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
                            {kind: 'Field', name: {kind: 'Name', value: 'key'}},
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
                                        {kind: 'Field', name: {kind: 'Name', value: 'name'}},
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
} as unknown as DocumentNode<ListAppsQuery, ListAppsQueryVariables>
