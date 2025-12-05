/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-duplicate-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type FetchStoreByDomainQueryVariables = Types.Exact<{
  domain?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type FetchStoreByDomainQuery = {
  organization?: {
    id: string
    name: string
    accessibleShops?: {
      edges: {
        node: {
          id: string
          externalId?: string | null
          name: string
          storeType?: Types.Store | null
          primaryDomain?: string | null
          shortName?: string | null
          url?: string | null
        }
      }[]
    } | null
    currentUser?: {organizationPermissions: string[]} | {organizationPermissions: string[]} | null
  } | null
}

export const FetchStoreByDomain = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'FetchStoreByDomain'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'domain'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'organization'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'accessibleShops'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'search'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'domain'}},
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
                                  {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'externalId'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'storeType'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'primaryDomain'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'shortName'}},
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
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'currentUser'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'organizationPermissions'}},
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
} as unknown as DocumentNode<FetchStoreByDomainQuery, FetchStoreByDomainQueryVariables>
