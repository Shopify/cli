/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ResolveStoreByIdQueryVariables = Types.Exact<{
  id: Types.Scalars['DestinationPublicID']['input']
}>

export type ResolveStoreByIdQuery = {
  currentUserAccount?: {destination?: {webUrl: string; primaryDomain?: string | null} | null} | null
}

export const ResolveStoreById = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ResolveStoreById'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'DestinationPublicID'}}},
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
                  name: {kind: 'Name', value: 'destination'},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'webUrl'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'primaryDomain'}},
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
} as unknown as DocumentNode<ResolveStoreByIdQuery, ResolveStoreByIdQueryVariables>
