/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type StoreInfoDestinationsQueryVariables = Types.Exact<{
  search: Types.Scalars['String']['input']
}>

export type StoreInfoDestinationsQuery = {
  currentUserAccount?: {
    destinations: {nodes: {publicId: unknown; primaryDomain?: string | null; webUrl: string}[]}
  } | null
}

export const StoreInfoDestinations = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'StoreInfoDestinations'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'search'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'currentUserAccount'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'destinations'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'search'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'search'}},
                    },
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'shopsOnly'},
                      value: {kind: 'BooleanValue', value: true},
                    },
                    {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '25'}},
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
                            {kind: 'Field', name: {kind: 'Name', value: 'publicId'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'primaryDomain'}},
                            {kind: 'Field', name: {kind: 'Name', value: 'webUrl'}},
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
} as unknown as DocumentNode<StoreInfoDestinationsQuery, StoreInfoDestinationsQueryVariables>
