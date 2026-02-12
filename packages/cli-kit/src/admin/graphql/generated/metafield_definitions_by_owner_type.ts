/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */
import {JsonMapType} from '@shopify/cli-kit/shared/node/toml'
import * as Types from './types.js'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type MetafieldDefinitionsByOwnerTypeQueryVariables = Types.Exact<{
  ownerType: Types.MetafieldOwnerType
}>

export type MetafieldDefinitionsByOwnerTypeQuery = {
  metafieldDefinitions: {
    nodes: {
      key: string
      name: string
      namespace: string
      description?: string | null
      type: {category: string; name: string}
    }[]
  }
}

export const MetafieldDefinitionsByOwnerType = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'metafieldDefinitionsByOwnerType'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'ownerType'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'MetafieldOwnerType'}}},
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
              {kind: 'Argument', name: {kind: 'Name', value: 'first'}, value: {kind: 'IntValue', value: '250'}},
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
} as unknown as DocumentNode<MetafieldDefinitionsByOwnerTypeQuery, MetafieldDefinitionsByOwnerTypeQueryVariables>
