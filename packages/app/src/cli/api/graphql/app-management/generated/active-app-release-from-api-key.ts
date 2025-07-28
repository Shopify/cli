/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as Types from './types.js'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type ActiveAppReleaseFromApiKeyQueryVariables = Types.Exact<{
  apiKey: Types.Scalars['String']['input']
}>

export type ActiveAppReleaseFromApiKeyQuery = {
  app: {
    id: string
    key: string
    activeRoot: {clientCredentials: {secrets: {key: string}[]}}
    activeRelease: {
      id: string
      version: {
        name: string
        appModules: {
          uuid: string
          userIdentifier: string
          handle: string
          config: JsonMapType
          specification: {identifier: string; externalIdentifier: string; name: string; managementExperience: string}
        }[]
      }
    }
  }
}

export const ActiveAppReleaseFromApiKey = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {kind: 'Name', value: 'ActiveAppReleaseFromApiKey'},
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
          type: {kind: 'NonNullType', type: {kind: 'NamedType', name: {kind: 'Name', value: 'String'}}},
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: {kind: 'Name', value: 'app'},
            name: {kind: 'Name', value: 'appByKey'},
            arguments: [
              {
                kind: 'Argument',
                name: {kind: 'Name', value: 'key'},
                value: {kind: 'Variable', name: {kind: 'Name', value: 'apiKey'}},
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'FragmentSpread', name: {kind: 'Name', value: 'AppVersionInfo'}},
                {kind: 'Field', name: {kind: 'Name', value: '__typename'}},
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'ReleasedAppModule'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'AppModule'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'uuid'}},
          {kind: 'Field', name: {kind: 'Name', value: 'userIdentifier'}},
          {kind: 'Field', name: {kind: 'Name', value: 'handle'}},
          {kind: 'Field', name: {kind: 'Name', value: 'config'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specification'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'managementExperience'}},
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'AppVersionInfo'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'App'}},
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
                          selections: [{kind: 'Field', name: {kind: 'Name', value: 'key'}}],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'activeRelease'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'id'}},
                {
                  kind: 'Field',
                  name: {kind: 'Name', value: 'version'},
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                      {
                        kind: 'Field',
                        name: {kind: 'Name', value: 'appModules'},
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [{kind: 'FragmentSpread', name: {kind: 'Name', value: 'ReleasedAppModule'}}],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ActiveAppReleaseFromApiKeyQuery, ActiveAppReleaseFromApiKeyQueryVariables>
