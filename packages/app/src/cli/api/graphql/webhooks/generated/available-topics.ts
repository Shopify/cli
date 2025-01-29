/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AvailableTopicsQueryVariables = Types.Exact<{
  apiVersion: Types.Scalars['String']['input']
}>

export type AvailableTopicsQuery = {availableTopics?: string[] | null}

export const AvailableTopics = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'availableTopics'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiVersion'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'availableTopics'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'apiVersion'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'apiVersion'}},
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AvailableTopicsQuery, AvailableTopicsQueryVariables>
