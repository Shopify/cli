/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListOrganizationsQueryVariables = Types.Exact<{[key: string]: never}>

export type ListOrganizationsQuery = {
  currentUserAccount?: {
    uuid: string
    organizationsWithAccessToDestination: {nodes: {id: string; name: string}[]}
  } | null
}

export const ListOrganizations = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ListOrganizations'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'currentUserAccount'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'uuid'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'organizationsWithAccessToDestination'},
                  arguments: [
                    {
                      kind: 'Argument',
                      name: {kind: 'Name', value: 'destination'},
                      value: {kind: 'EnumValue', value: 'APPS_CLI'},
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
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ListOrganizationsQuery, ListOrganizationsQueryVariables>
