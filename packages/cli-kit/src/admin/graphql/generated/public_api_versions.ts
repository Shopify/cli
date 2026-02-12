/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import {JsonMapType} from '@shopify/cli-kit/shared/node/toml'
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type PublicApiVersionsQueryVariables = Types.Exact<{[key: string]: never}>

export type PublicApiVersionsQuery = {publicApiVersions: {handle: string; supported: boolean}[]}

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
                {kind: 'Field', name: {kind: 'Name', value: 'supported'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PublicApiVersionsQuery, PublicApiVersionsQueryVariables>
