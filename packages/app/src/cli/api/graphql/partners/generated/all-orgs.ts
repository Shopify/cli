/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AllOrgsQueryVariables = Types.Exact<{[key: string]: never}>

export type AllOrgsQuery = {organizations: {nodes?: ({id: string; businessName: string} | null)[] | null}}

export const AllOrgs = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'AllOrgs'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'organizations'},
            arguments: [
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '200'}},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'businessName'}},
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
} as unknown as DocumentNode<AllOrgsQuery, AllOrgsQueryVariables>
