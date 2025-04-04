/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ExtensionUpdateDraftMutationVariables = Types.Exact<{
  apiKey: Types.Scalars['String']['input']
  registrationId: Types.Scalars['ID']['input']
  config: Types.Scalars['JSON']['input']
  context?: Types.InputMaybe<Types.Scalars['String']['input']>
  handle?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type ExtensionUpdateDraftMutation = {
  extensionUpdateDraft?: {userErrors?: {field?: string[] | null; message: string}[] | null} | null
}

export const ExtensionUpdateDraft = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'ExtensionUpdateDraft'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'registrationId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'config'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'JSON'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'context'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'handle'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'extensionUpdateDraft'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'input'},
                value: {
                  kind: 'ObjectValue',
                  fields: [
                    {
                      kind: 'ObjectField',
                      name: {kind: 'Name', value: 'apiKey'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
                    },
                    {
                      kind: 'ObjectField',
                      name: {kind: 'Name', value: 'registrationId'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'registrationId'}},
                    },
                    {
                      kind: 'ObjectField',
                      name: {kind: 'Name', value: 'config'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'config'}},
                    },
                    {
                      kind: 'ObjectField',
                      name: {kind: 'Name', value: 'context'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'context'}},
                    },
                    {
                      kind: 'ObjectField',
                      name: {kind: 'Name', value: 'handle'},
                      value: {kind: 'Variable', name: {kind: 'Name', value: 'handle'}},
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
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
} as unknown as DocumentNode<ExtensionUpdateDraftMutation, ExtensionUpdateDraftMutationVariables>
