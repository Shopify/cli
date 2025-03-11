function projectFactory(name: string, schemaName: string, project: string = 'app', graphqlPath: string = 'graphql') {
  return {
    schema: `./packages/${project}/src/cli/api/graphql/${name}/${schemaName}`,
    documents: [
      `./packages/${project}/src/cli/api/graphql/${name}/queries/**/*.graphql`,
      `./packages/${project}/src/cli/api/graphql/${name}/mutations/**/*.graphql`,
    ],
    extensions: {
      codegen: {
        generates: {
          [`./packages/${project}/src/cli/api/graphql/${name}/generated/types.d.ts`]: {
            plugins: [
              {'graphql-codegen-typescript-operation-types': {enumsAsTypes: true, useTypeImports: true}},
              {
                add: {
                  content:
                    "/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any, tsdoc/syntax, @typescript-eslint/no-duplicate-type-constituents  */\nimport {JsonMapType} from '@shopify/cli-kit/node/toml'",
                },
              },
            ],
            config: {
              omitObjectTypes: true,
              scalars: {
                GlobalID: 'string',
                PropertyId: 'string',
                PropertyPublicID: 'string',
                JSON: {input: 'JsonMapType | string', output: 'JsonMapType'},
                URL: 'string',
              },
            },
          },
          [`./packages/${project}/src/cli/api/graphql/${name}/generated/`]: {
            preset: 'near-operation-file',
            plugins: [
              {
                add: {
                  content:
                    "/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents */\nimport {JsonMapType} from '@shopify/cli-kit/node/toml'",
                },
              },
              {
                'typescript-operations': {
                  preResolveTypes: true,
                  skipTypename: true,
                  useTypeImports: true,
                  onlyOperationTypes: true,
                  scalars: {
                    GlobalID: 'string',
                    PropertyId: 'string',
                    PropertyPublicID: 'string',
                    JSON: {input: 'JsonMapType | string', output: 'JsonMapType'},
                    URL: 'string',
                  },
                },
              },
              {
                'typed-document-node': {
                  addTypenameToSelectionSets: true,
                },
              },
            ],
            presetConfig: {
              extension: '.ts',
              typesPath: './types.js',
              baseTypesPath: './types.js',
              folder: '../generated',
              useTypeImports: true,
            },
          },
          [`./packages/${project}/src/cli/api/graphql/${name}/generated/mocks.ts`]: {
            // preset: 'import-types',
            presetConfig: {
              typesPath: './types.js',
            },
            documents: ['src/**/*.graphql'],
            // preset: 'import-types',
            plugins: [
              {
                add: {
                  content:
                    "/* eslint-disable @typescript-eslint/no-unused-vars, tsdoc/syntax, @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents */\nimport {JsonMapType} from '@shopify/cli-kit/node/toml'",
                },
              },
              {
                'graphql-codegen-typescript-operation-types': {
                  enumsAsTypes: true,
                  useTypeImports: true,
                  noExport: true,
                  preResolveTypes: true,
                  omitObjectTypes: true,
                },
              },
              {
                'typescript-operations': {
                  noExport: true,
                  skipTypename: true,
                  useTypeImports: true,
                  preResolveTypes: true,
                  omitObjectTypes: true,
                  scalars: {
                    GlobalID: 'string',
                    PropertyId: 'string',
                    PropertyPublicID: 'string',
                    JSON: {input: 'JsonMapType | string', output: 'JsonMapType'},
                    URL: 'string',
                  },
                },
              },
              {
                'typescript-msw': {
                  link: {
                    name: name
                      .split('-')
                      .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
                      .join(''),
                    endpoint: `https://${name}.shopify-cli.mock/${graphqlPath}`,
                  },
                },
              },
            ],
            // presetConfig: {
            //   typesPath: './types.js',
            // },
          },
        },
      },
    },
  }
}

export default {
  projects: {
    partners: projectFactory('partners', 'cli_schema.graphql', 'app', 'api/cli/graphql'),
    businessPlatformDestinations: projectFactory(
      'business-platform-destinations',
      'destinations_schema.graphql',
      'app',
      'destinations/api/2020-07/graphql',
    ),
    businessPlatformOrganizations: projectFactory('business-platform-organizations', 'organizations_schema.graphql'),
    appDev: projectFactory('app-dev', 'app_dev_schema.graphql'),
    appManagement: projectFactory(
      'app-management',
      'app_management_schema.graphql',
      'app',
      'app_management/unstable/organizations/xxxx/graphql.json',
    ),
    admin: projectFactory('admin', 'admin_schema.graphql', 'cli-kit'),
    webhooks: projectFactory('webhooks', 'webhooks_schema.graphql'),
    functions: projectFactory('functions', 'functions_cli_schema.graphql', 'app'),
  },
}
