/* oxlint-disable typescript/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type PublicApiVersionsQueryVariables = Types.Exact<{[key: string]: never}>

export type PublicApiVersionsQuery = {publicApiVersions: Array<{handle: string}>}

export const PublicApiVersions = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'publicApiVersions'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'publicApiVersions'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PublicApiVersionsQuery, PublicApiVersionsQueryVariables>
