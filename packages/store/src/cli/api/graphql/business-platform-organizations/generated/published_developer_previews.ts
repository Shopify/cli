/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type PublishedDeveloperPreviewsQueryQueryVariables = Types.Exact<{[key: string]: never}>

export type PublishedDeveloperPreviewsQueryQuery = {publishedDeveloperPreviews: {handle: string; name: string}[]}

export const PublishedDeveloperPreviewsQuery = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'PublishedDeveloperPreviewsQuery'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'publishedDeveloperPreviews'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PublishedDeveloperPreviewsQueryQuery, PublishedDeveloperPreviewsQueryQueryVariables>
