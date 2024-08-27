/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/ban-types */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListAppDevStoresQueryVariables = Types.Exact<{[key: string]: never}>

export type ListAppDevStoresQuery = {
  organization?: {
    id: string
    name: string
    properties?: {
      edges: {
        node:
          | {
              __typename: 'Shop'
              id: string
              externalId?: string | null
              name: string
              storeType?: Types.Store | null
              primaryDomain?: string | null
              shortName?: string | null
            }
          | {}
      }[]
    } | null
  } | null
}

export const ListAppDevStores = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ListAppDevStores'},
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
                  name: {kind: 'Name', value: 'properties'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'filters'},
                      value: {
                        kind: 'ObjectValue',
                        fields: [
                          {
                            kind: 'ObjectField',
                            name: {kind: 'Name', value: 'field'},
                            value: {kind: 'EnumValue', value: 'STORE_TYPE'},
                          },
                          {
                            kind: 'ObjectField',
                            name: {kind: 'Name', value: 'operator'},
                            value: {kind: 'EnumValue', value: 'EQUALS'},
                          },
                          {
                            kind: 'ObjectField',
                            name: {kind: 'Name', value: 'value'},
                            value: {kind: 'StringValue', value: 'app_development', block: false},
                          },
                        ],
                      },
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'offeringHandles'},
                      value: {kind: 'ListValue', values: [{kind: 'StringValue', value: 'shop', block: false}]},
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
                                    kind: 'InlineFragment',
                                    typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'Shop'}},
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'externalId'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'storeType'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'primaryDomain'}},
                                        {kind: 'Field', name: {kind: 'Name', value: 'shortName'}},
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
} as unknown as DocumentNode<ListAppDevStoresQuery, ListAppDevStoresQueryVariables>
