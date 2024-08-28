/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type GetThemeFileBodiesQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input']
  after?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type GetThemeFileBodiesQuery = {
  theme?: {
    files?: {
      nodes: {
        filename: string
        statusCode: Types.ThemeFileResultType
        file?: {
          size: number
          checksumMd5?: string | null
          body: {contentBase64: string} | {content: string} | {url: unknown}
        } | null
      }[]
    } | null
  } | null
}

export const GetThemeFileBodies = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'getThemeFileBodies'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'theme'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'id'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'files'},
                  arguments: [
                    {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '100'}},
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'after'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
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
                            {kind: 'Field', name: {kind: 'Name', value: 'filename'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'statusCode'}},
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'file'},
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {kind: 'Field', name: {kind: 'Name', value: 'size'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'checksumMd5'}},
                                  {
                                    kind: 'Field',
                                    name: {kind: 'Name', value: 'body'},
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'InlineFragment',
                                          typeCondition: {
                                            kind: 'NamedType',
                                            name: {kind: 'Name', value: 'ThemeFileBodyText'},
                                          },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {kind: 'Field', name: {kind: 'Name', value: 'content'}},
                                              {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                            ],
                                          },
                                        },
                                        {
                                          kind: 'InlineFragment',
                                          typeCondition: {
                                            kind: 'NamedType',
                                            name: {kind: 'Name', value: 'ThemeFileBodyBase64'},
                                          },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {kind: 'Field', name: {kind: 'Name', value: 'contentBase64'}},
                                              {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                            ],
                                          },
                                        },
                                        {
                                          kind: 'InlineFragment',
                                          typeCondition: {
                                            kind: 'NamedType',
                                            name: {kind: 'Name', value: 'ThemeFileBodyUrl'},
                                          },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {kind: 'Field', name: {kind: 'Name', value: 'url'}},
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
} as unknown as DocumentNode<GetThemeFileBodiesQuery, GetThemeFileBodiesQueryVariables>
