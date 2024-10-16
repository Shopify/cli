/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

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
          config: JsonMapType
          specification: {identifier: string; externalIdentifier: string; name: string}
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
                                  {kind: 'FragmentSpread', name: {kind: 'Name', value: 'ReleasedAppModule'}},
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
      name: {kind: 'Name', value: 'ReleasedAppModule'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'AppModule'}},
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
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ListAppsQuery, ListAppsQueryVariables>
