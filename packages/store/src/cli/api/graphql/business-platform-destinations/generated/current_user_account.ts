/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CurrentUserAccountQueryVariables = Types.Exact<{[key: string]: never}>

export type CurrentUserAccountQuery = {
  currentUserAccount?: {
    email: string
    organizations: {
      edges: {
        node: {
          id: string
          name: string
          categories?:
            | {
                destinations: {
                  edges: {
                    node: {
                      id: unknown
                      name: string
                      status: Types.DestinationStatus
                      publicId: unknown
                      handle?: string | null
                      shortName?: string | null
                      webUrl: string
                    }
                  }[]
                  pageInfo: {endCursor?: string | null; hasNextPage: boolean}
                }
              }[]
            | null
        }
      }[]
      pageInfo: {endCursor?: string | null; hasNextPage: boolean}
    }
    orphanDestinations: {
      categories?:
        | {
            destinations: {
              edges: {
                node: {
                  id: unknown
                  name: string
                  status: Types.DestinationStatus
                  publicId: unknown
                  handle?: string | null
                  shortName?: string | null
                  webUrl: string
                }
              }[]
              pageInfo: {endCursor?: string | null; hasNextPage: boolean}
            }
          }[]
        | null
    }
  } | null
}

export type DestinationFieldsFragment = {
  id: unknown
  name: string
  status: Types.DestinationStatus
  publicId: unknown
  handle?: string | null
  shortName?: string | null
  webUrl: string
}

export const DestinationFieldsFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'destinationFields'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'Destination'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'id'}},
          {kind: 'Field', name: {kind: 'Name', value: 'name'}},
          {kind: 'Field', name: {kind: 'Name', value: 'status'}},
          {kind: 'Field', name: {kind: 'Name', value: 'publicId'}},
          {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
          {kind: 'Field', name: {kind: 'Name', value: 'shortName'}},
          {kind: 'Field', name: {kind: 'Name', value: 'webUrl'}},
        ],
      },
    },
  ],
} as unknown as DocumentNode<DestinationFieldsFragment, unknown>
export const CurrentUserAccount = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'currentUserAccount'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'currentUserAccount'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'email'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'organizations'},
                  arguments: [
                    {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '100'}},
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
                                  {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                                  {
                                    kind: 'Field',
                                    name: {kind: 'Name', value: 'categories'},
                                    arguments: [
                                      {
                                        kind: 'Argument',
                                        name: {kind: 'Name', value: 'handles'},
                                        value: {kind: 'EnumValue', value: 'STORES'},
                                      },
                                    ],
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: {kind: 'Name', value: 'destinations'},
                                          arguments: [
                                            {
                                              kind: 'Argument',
                                              name: {kind: 'Name', value: 'first'},
                                              value: {kind: 'IntValue', value: '100'},
                                            },
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
                                                          {
                                                            kind: 'FragmentSpread',
                                                            name: {kind: 'Name', value: 'destinationFields'},
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
                                                    {kind: 'Field', name: {kind: 'Name', value: 'endCursor'}},
                                                    {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
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
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'pageInfo'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {kind: 'Field', name: {kind: 'Name', value: 'endCursor'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
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
                  name: {kind: 'Name', value: 'orphanDestinations'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'categories'},
                        arguments: [
                          {
                            kind: 'Argument',
                            name: {kind: 'Name', value: 'handles'},
                            value: {kind: 'EnumValue', value: 'STORES'},
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'destinations'},
                              arguments: [
                                {
                                  kind: 'Argument',
                                  name: {kind: 'Name', value: 'first'},
                                  value: {kind: 'IntValue', value: '100'},
                                },
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
                                              {
                                                kind: 'FragmentSpread',
                                                name: {kind: 'Name', value: 'destinationFields'},
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
                                        {kind: 'Field', name: {kind: 'Name', value: 'endCursor'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
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
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'destinationFields'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'Destination'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'id'}},
          {kind: 'Field', name: {kind: 'Name', value: 'name'}},
          {kind: 'Field', name: {kind: 'Name', value: 'status'}},
          {kind: 'Field', name: {kind: 'Name', value: 'publicId'}},
          {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
          {kind: 'Field', name: {kind: 'Name', value: 'shortName'}},
          {kind: 'Field', name: {kind: 'Name', value: 'webUrl'}},
        ],
      },
    },
  ],
} as unknown as DocumentNode<CurrentUserAccountQuery, CurrentUserAccountQueryVariables>
