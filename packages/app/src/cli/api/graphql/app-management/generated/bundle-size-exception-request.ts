/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type BundleSizeExceptionRequestMutationVariables = Types.Exact<{
  appId: Types.Scalars['ID']['input']
  reason: Types.Scalars['String']['input']
  extensions: Types.UiExtensionSizeContextInput[] | Types.UiExtensionSizeContextInput
}>

export type BundleSizeExceptionRequestMutation = {
  appUiExtensionBundleSizeExceptionRequest: {
    exception?: {status: Types.UiExtensionBundleSizeExceptionStatus; effectiveLimitKb: number} | null
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      code?: Types.Code | null
      on: JsonMapType
    }[]
  }
}

export const BundleSizeExceptionRequest = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'BundleSizeExceptionRequest'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'reason'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'extensions'}},
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: {kind: 'NamedType', name: {kind: 'Name', value: 'UiExtensionSizeContextInput'}},
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appUiExtensionBundleSizeExceptionRequest'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appId'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appId'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'reason'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'reason'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'extensions'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'extensions'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'exception'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'status'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'effectiveLimitKb'}},
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
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'code'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'on'}},
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
} as unknown as DocumentNode<BundleSizeExceptionRequestMutation, BundleSizeExceptionRequestMutationVariables>
