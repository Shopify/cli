/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-duplicate-type-constituents */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type FetchSpecificationsQueryVariables = Types.Exact<{
  organizationId: Types.Scalars['ID']['input']
}>

export type FetchSpecificationsQuery = {
  specifications: {
    name: string
    identifier: string
    externalIdentifier: string
    features: string[]
    uidStrategy:
      | {appModuleLimit: number; isClientProvided: boolean}
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
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'organizationId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specifications'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'organizationId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'organizationId'}},
              },
            ],
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
