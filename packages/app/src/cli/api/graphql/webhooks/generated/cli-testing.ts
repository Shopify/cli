/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CliTestingMutationVariables = Types.Exact<{
  address: Types.Scalars['String']['input']
  apiKey?: Types.InputMaybe<Types.Scalars['String']['input']>
  apiVersion: Types.Scalars['String']['input']
  deliveryMethod: Types.Scalars['String']['input']
  sharedSecret: Types.Scalars['String']['input']
  topic: Types.Scalars['String']['input']
}>

export type CliTestingMutation = {
  cliTesting?: {headers?: string | null; samplePayload?: string | null; success: boolean; errors: string[]} | null
}

export const CliTesting = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CliTesting'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'address'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiVersion'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'deliveryMethod'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'sharedSecret'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'topic'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'cliTesting'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'address'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'address'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'apiKey'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'apiVersion'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'apiVersion'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'deliveryMethod'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'deliveryMethod'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'sharedSecret'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'sharedSecret'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'topic'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'topic'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'headers'}},
                {kind: 'Field', name: {kind: 'Name', value: 'samplePayload'}},
                {kind: 'Field', name: {kind: 'Name', value: 'success'}},
                {kind: 'Field', name: {kind: 'Name', value: 'errors'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CliTestingMutation, CliTestingMutationVariables>
