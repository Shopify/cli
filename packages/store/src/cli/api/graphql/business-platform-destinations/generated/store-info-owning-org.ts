/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type StoreInfoOwningOrgQueryVariables = Types.Exact<{
  destinationPublicId: Types.Scalars['DestinationPublicID']['input']
}>

export type StoreInfoOwningOrgQuery = {
  currentUserAccount?: {organizationForDestination?: {id: string; name: string} | null} | null
}

export const StoreInfoOwningOrg = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'StoreInfoOwningOrg'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'destinationPublicId'}},
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
                  name: {kind: 'Name', value: 'organizationForDestination'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'destinationPublicId'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'destinationPublicId'}},
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
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
} as unknown as DocumentNode<StoreInfoOwningOrgQuery, StoreInfoOwningOrgQueryVariables>
