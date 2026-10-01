/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateSourceScanMutationVariables = Types.Exact<{
  clientId: Types.Scalars['String']['input']
  sourceScanUrl: Types.Scalars['URL']['input']
}>

export type CreateSourceScanMutation = {
  appSourceScanCreate: {accepted: boolean; userErrors: {field?: string[] | null; message: string}[]}
}

export const CreateSourceScan = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CreateSourceScan'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'clientId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'sourceScanUrl'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'URL'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appSourceScanCreate'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'clientId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'clientId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'sourceScanUrl'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'sourceScanUrl'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'accepted'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'field'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
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
} as unknown as DocumentNode<CreateSourceScanMutation, CreateSourceScanMutationVariables>
