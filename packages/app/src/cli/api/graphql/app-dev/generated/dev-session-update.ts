/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type DevSessionUpdateMutationVariables = Types.Exact<{
  appId: Types.Scalars['String']['input']
  assetsUrl: Types.Scalars['String']['input']
  manifest: Types.Scalars['JSON']['input']
  inheritedModuleUids: Types.Scalars['String']['input'][]
}>

export type DevSessionUpdateMutation = {
  devSessionUpdate?: {
    userErrors: {message: string; on: JsonMapType; field?: string[] | null; category: string}[]
  } | null
}

export const DevSessionUpdate = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'DevSessionUpdate'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'assetsUrl'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'manifest'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'JSON'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'inheritedModuleUids'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'devSessionUpdate'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'assetsUrl'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'assetsUrl'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'manifest'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'manifest'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'inheritedModuleUids'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'inheritedModuleUids'}},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'on'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'field'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
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
} as unknown as DocumentNode<DevSessionUpdateMutation, DevSessionUpdateMutationVariables>
