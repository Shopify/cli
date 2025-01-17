/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type TunnelCreateMutationVariables = Types.Exact<{[key: string]: never}>

export type TunnelCreateMutation = {
  tunnelCreate: {
    tunnelUrl?: string | null
    tunnelSecret?: string | null
    tunnelId?: string | null
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      code?: Types.Code | null
      on: JsonMapType
    }[]
  }
}

export const TunnelCreate = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'tunnelCreate'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'tunnelCreate'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'tunnelUrl'}},
                {kind: 'Field', name: {kind: 'Name', value: 'tunnelSecret'}},
                {kind: 'Field', name: {kind: 'Name', value: 'tunnelId'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'field'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'code'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'on'}},
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
} as unknown as DocumentNode<TunnelCreateMutation, TunnelCreateMutationVariables>
