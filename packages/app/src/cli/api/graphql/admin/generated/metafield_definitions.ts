/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type MetafieldForImportFragment = {
  key: string
  name: string
  namespace: string
  description?: string | null
  type: {category: string; name: string}
  access: {
    admin?: Types.MetafieldAdminAccess | null
    storefront?: Types.MetafieldStorefrontAccess | null
    customerAccount: Types.MetafieldCustomerAccountAccess
  }
  capabilities: {adminFilterable: {enabled: boolean}}
  validations: {name: string; value?: string | null}[]
}

export type MetafieldDefinitionsQueryVariables = Types.Exact<{
  ownerType: Types.MetafieldOwnerType
  after?: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type MetafieldDefinitionsQuery = {
  metafieldDefinitions: {
    pageInfo: {hasNextPage: boolean; endCursor?: string | null}
    nodes: {
      key: string
      name: string
      namespace: string
      description?: string | null
      type: {category: string; name: string}
      access: {
        admin?: Types.MetafieldAdminAccess | null
        storefront?: Types.MetafieldStorefrontAccess | null
        customerAccount: Types.MetafieldCustomerAccountAccess
      }
      capabilities: {adminFilterable: {enabled: boolean}}
      validations: {name: string; value?: string | null}[]
    }[]
  }
}

export const MetafieldForImportFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'MetafieldForImport'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'MetafieldDefinition'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'key'}},
          {kind: 'Field', name: {kind: 'Name', value: 'name'}},
          {kind: 'Field', name: {kind: 'Name', value: 'namespace'}},
          {kind: 'Field', name: {kind: 'Name', value: 'description'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'type'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'access'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'admin'}},
                {kind: 'Field', name: {kind: 'Name', value: 'storefront'}},
                {kind: 'Field', name: {kind: 'Name', value: 'customerAccount'}},
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'capabilities'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'adminFilterable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{kind: 'Field', name: {kind: 'Name', value: 'enabled'}}],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'validations'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'value'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MetafieldForImportFragment, unknown>
export const MetafieldDefinitions = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'metafieldDefinitions'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'ownerType'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'MetafieldOwnerType'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
          type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'metafieldDefinitions'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'ownerType'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'ownerType'}},
              },
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '30'}},
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'after'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'after'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'pageInfo'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'hasNextPage'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'endCursor'}},
                      {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'nodes'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'FragmentSpread', name: {kind: 'Name', value: 'MetafieldForImport'}},
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
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'MetafieldForImport'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'MetafieldDefinition'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'key'}},
          {kind: 'Field', name: {kind: 'Name', value: 'name'}},
          {kind: 'Field', name: {kind: 'Name', value: 'namespace'}},
          {kind: 'Field', name: {kind: 'Name', value: 'description'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'type'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'access'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'admin'}},
                {kind: 'Field', name: {kind: 'Name', value: 'storefront'}},
                {kind: 'Field', name: {kind: 'Name', value: 'customerAccount'}},
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'capabilities'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'adminFilterable'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{kind: 'Field', name: {kind: 'Name', value: 'enabled'}}],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'validations'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'value'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MetafieldDefinitionsQuery, MetafieldDefinitionsQueryVariables>
