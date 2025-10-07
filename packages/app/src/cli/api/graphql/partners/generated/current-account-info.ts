/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CurrentAccountInfoQueryVariables = Types.Exact<{[key: string]: never}>

export type CurrentAccountInfoQuery = {
  currentAccountInfo: {__typename: 'ServiceAccount'; orgName: string} | {__typename: 'UserAccount'; email: string}
}

export const CurrentAccountInfo = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'currentAccountInfo'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'currentAccountInfo'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                {
                  kind: 'InlineFragment',
                  typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'ServiceAccount'}},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'orgName'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {
                  kind: 'InlineFragment',
                  typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'UserAccount'}},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'email'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CurrentAccountInfoQuery, CurrentAccountInfoQueryVariables>
