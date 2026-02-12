/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import {JsonMapType} from '@shopify/cli-kit/shared/node/toml'
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type OnlineStorePasswordProtectionQueryVariables = Types.Exact<{[key: string]: never}>

export type OnlineStorePasswordProtectionQuery = {onlineStore: {passwordProtection: {enabled: boolean}}}

export const OnlineStorePasswordProtection = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'OnlineStorePasswordProtection'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'onlineStore'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'passwordProtection'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'enabled'}},
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
} as unknown as DocumentNode<OnlineStorePasswordProtectionQuery, OnlineStorePasswordProtectionQueryVariables>
