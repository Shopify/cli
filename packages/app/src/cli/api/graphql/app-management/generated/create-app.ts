/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type CreateAppMutationVariables = Types.Exact<{
  appSource: Types.AppSourceInput
  name: Types.Scalars['String']['input']
}>

export type CreateAppMutation = {
  appCreate: {
    app?: {id: string; key: string; activeRoot: {clientCredentials: {secrets: {key: string}[]}}} | null
    userErrors: {category: string; message: string; on: JsonMapType}[]
  }
}

export const CreateApp = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {kind: 'Name', value: 'CreateApp'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'appSource'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'AppSourceInput'}}},
        },
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'name'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'appCreate'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'appSource'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'appSource'}},
              },
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'name'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'name'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'app'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'key'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'activeRoot'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: {kind: 'Name', value: 'clientCredentials'},
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: {kind: 'Name', value: 'secrets'},
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {kind: 'Field', name: {kind: 'Name', value: 'key'}},
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
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'userErrors'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'category'}},
                      {kind: 'Field', name: {kind: 'Name', value: 'message'}},
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
} as unknown as DocumentNode<CreateAppMutation, CreateAppMutationVariables>
