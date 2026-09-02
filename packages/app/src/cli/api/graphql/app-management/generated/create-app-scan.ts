/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateAppScanMutationVariables = Types.Exact<{
  appId: Types.Scalars['ID']['input']
  scanUrl: Types.Scalars['URL']['input']
  metadata?: Types.InputMaybe<Types.AppScanMetadataInput>
}>

export type CreateAppScanMutation = {
  appScanCreate: {scan?: {id: string} | null; userErrors: {field?: string[] | null; message: string}[]}
}

export const CreateAppScan = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CreateAppScan'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'scanUrl'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'URL'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'metadata'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'AppScanMetadataInput'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appScanCreate'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'scanUrl'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'scanUrl'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'metadata'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'metadata'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'scan'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
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
} as unknown as DocumentNode<CreateAppScanMutation, CreateAppScanMutationVariables>
