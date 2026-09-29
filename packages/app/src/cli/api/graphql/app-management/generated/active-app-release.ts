/* eslint-disable @typescript-eslint/consistent-type-definitions */
import {JsonMapType} from '@shopify/cli-kit/node/toml'

import {TypedDocumentNode as DocumentNode} from '@graphql-typed-document-node/core'

export type AppVersionInfoFragment = {
  id: string
  key: string
  organizationId: string
  activeRoot: {grantedShopifyApprovalScopes: string[]; clientCredentials: {secrets: {key: string}[]}}
  activeRelease: {
    id: string
    version: {
      name: string
      appModules: {
        uuid: string
        userIdentifier: string
        handle: string
        config: JsonMapType
        target?: string | null
        specification: {
          identifier: string
          externalIdentifier: string
          name: string
          experience: string
          managementExperience: string
        }
      }[]
    }
  }
}

export type ReleasedAppModuleFragment = {
  uuid: string
  userIdentifier: string
  handle: string
  config: JsonMapType
  target?: string | null
  specification: {
    identifier: string
    externalIdentifier: string
    name: string
    experience: string
    managementExperience: string
  }
}

export const ReleasedAppModuleFragmentDoc = {
  kind: 'Document',
  definitions: [
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
          {kind: 'Field', name: {kind: 'Name', value: 'target'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specification'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'experience'}},
                {kind: 'Field', name: {kind: 'Name', value: 'managementExperience'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ReleasedAppModuleFragment, unknown>
export const AppVersionInfoFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: {kind: 'Name', value: 'AppVersionInfo'},
      typeCondition: {kind: 'NamedType', name: {kind: 'Name', value: 'App'}},
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {kind: 'Field', name: {kind: 'Name', value: 'id'}},
          {kind: 'Field', name: {kind: 'Name', value: 'key'}},
          {kind: 'Field', name: {kind: 'Name', value: 'organizationId'}},
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
                {kind: 'Field', name: {kind: 'Name', value: 'grantedShopifyApprovalScopes'}},
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
          {kind: 'Field', name: {kind: 'Name', value: 'target'}},
          {
            kind: 'Field',
            name: {kind: 'Name', value: 'specification'},
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {kind: 'Field', name: {kind: 'Name', value: 'identifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'externalIdentifier'}},
                {kind: 'Field', name: {kind: 'Name', value: 'name'}},
                {kind: 'Field', name: {kind: 'Name', value: 'experience'}},
                {kind: 'Field', name: {kind: 'Name', value: 'managementExperience'}},
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AppVersionInfoFragment, unknown>
