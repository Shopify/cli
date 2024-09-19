/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type DevStoresByOrgQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input']
}>

export type DevStoresByOrgQuery = {
  organizations: {
    nodes?:
      | ({
          id: string
          stores: {
            nodes?:
              | ({
                  shopId?: string | null
                  link: unknown
                  shopDomain: string
                  shopName: string
                  transferDisabled: boolean
                  convertableToPartnerTest: boolean
                } | null)[]
              | null
          }
        } | null)[]
      | null
  }
}

export const DevStoresByOrg = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'DevStoresByOrg'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'ID'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'organizations'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'id'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'id'}},
              },
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '1'}},
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'nodes'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'stores'},
                        arguments: [
                          {
                            kind: 'Argument',
                            name: {kind: 'Name', value: 'first'},
                            value: {kind: 'IntValue', value: '500'},
                          },
                          {
                            kind: 'Argument',
                            name: {kind: 'Name', value: 'archived'},
                            value: {kind: 'BooleanValue', value: false},
                          },
                          {
                            kind: 'Argument',
                            name: {kind: 'Name', value: 'type'},
                            value: {
                              kind: 'ListValue',
                              values: [
                                {kind: 'EnumValue', value: 'DEVELOPMENT'},
                                {kind: 'EnumValue', value: 'MANAGED'},
                                {kind: 'EnumValue', value: 'PLUS_SANDBOX'},
                              ],
                            },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'nodes'},
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {kind: 'Field', name: {kind: 'Name', value: 'shopId'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'link'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'shopDomain'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'shopName'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'transferDisabled'}},
                                  {kind: 'Field', name: {kind: 'Name', value: 'convertableToPartnerTest'}},
                                  {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                                ],
                              },
                            },
                            {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                          ],
                        },
                      },
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
} as unknown as DocumentNode<DevStoresByOrgQuery, DevStoresByOrgQueryVariables>
