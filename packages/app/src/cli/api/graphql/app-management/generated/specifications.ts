/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-duplicate-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type FetchSpecificationsQueryVariables = Types.Exact<{[key: string]: never}>

export type FetchSpecificationsQuery = {
  specifications: {
    name: string
    identifier: string
    externalIdentifier: string
    features: string[]
    uidStrategy:
      | {appModuleLimit: number; isClientProvided: boolean}
      | {appModuleLimit: number; isClientProvided: boolean}
    validationSchema?: {jsonSchema: string} | null
  }[]
}

export const FetchSpecifications = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'fetchSpecifications'},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specifications'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'features'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'uidStrategy'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'appModuleLimit'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'isClientProvided'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'validationSchema'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'jsonSchema'}},
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
} as unknown as DocumentNode<FetchSpecificationsQuery, FetchSpecificationsQueryVariables>
