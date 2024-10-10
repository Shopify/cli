/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ListAppsQueryVariables = Types.Exact<{[key: string]: never}>

export type ListAppsQuery = {
  apps: {
    id: string
    key: string
    activeRelease: {
      id: string
      version: {
        name: string
        appModules: {
          uuid: string
          handle: string
          config: string
          specification: {externalIdentifier?: string | null}
        }[]
      }
    }
  }[]
}

export const ListApps = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'listApps'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'apps'},
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
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'appModules'},
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {kind: 'Field', name: {kind: 'Name', value: 'uuid'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'config'}},
                                  {
                                    kind: 'Field',
                                    name: {kind: 'Name', value: 'specification'},
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
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
} as unknown as DocumentNode<ListAppsQuery, ListAppsQueryVariables>
