/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ProvisionShopAccessMutationVariables = Types.Exact<{
  input: Types.OrganizationUserProvisionShopAccessInput
}>

export type ProvisionShopAccessMutation = {
  organizationUserProvisionShopAccess: {success?: boolean | null; userErrors?: {message: string}[] | null}
}

export const ProvisionShopAccess = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'ProvisionShopAccess'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'input'}},
          type: {
            kind: 'NonNullType',
            type: {kind: 'NamedType', name: {kind: 'Name', value: 'OrganizationUserProvisionShopAccessInput'}},
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'organizationUserProvisionShopAccess'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'organizationUserProvisionShopAccessInput'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'input'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'success'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
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
} as unknown as DocumentNode<ProvisionShopAccessMutation, ProvisionShopAccessMutationVariables>
