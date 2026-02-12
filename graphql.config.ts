function graphqlBasePath(name: string, project: string): string {
  if (project === 'cli-kit') {
    // cli-kit uses domain-based structure: src/admin/graphql/
    return `./packages/cli-kit/src/admin/graphql`
  }
  return `./packages/${project}/src/cli/api/graphql/${name}`
}

function projectFactory(name: string, schemaName: string, project: string = 'app') {
  const basePath = graphqlBasePath(name, project)
  return {
    schema: `${basePath}/${schemaName}`,
    documents: [`${basePath}/queries/**/*.graphql`, `${basePath}/mutations/**/*.graphql`],
    extensions: {
      codegen: {
        generates: {
          [`${basePath}/generated/types.d.ts`]: {
            plugins: [
              {'graphql-codegen-typescript-operation-types': {enumsAsTypes: true, useTypeImports: true}},
              {
                add: {
                  content:
                    "/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any, tsdoc/syntax, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries  */\nimport {JsonMapType} from '@shopify/cli-kit/shared/node/toml'",
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
          [`${basePath}/generated/`]: {
            preset: 'near-operation-file',
            plugins: [
              {
                add: {
                  content:
                    "/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-duplicate-type-constituents, @typescript-eslint/no-redundant-type-constituents, @nx/enforce-module-boundaries */\nimport {JsonMapType} from '@shopify/cli-kit/shared/node/toml'",
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
        },
      },
    },
  }
}

export default {
  projects: {
    partners: projectFactory('partners', 'cli_schema.graphql'),
    businessPlatformDestinations: projectFactory('business-platform-destinations', 'destinations_schema.graphql'),
    businessPlatformOrganizations: projectFactory('business-platform-organizations', 'organizations_schema.graphql'),
    appDev: projectFactory('app-dev', 'app_dev_schema.graphql'),
    appManagement: projectFactory('app-management', 'app_management_schema.graphql'),
    admin: projectFactory('admin', 'admin_schema.graphql', 'cli-kit'),
    bulkOperations: projectFactory('bulk-operations', 'admin_schema.graphql'),
    webhooks: projectFactory('webhooks', 'webhooks_schema.graphql'),
    functions: projectFactory('functions', 'functions_cli_schema.graphql', 'app'),
    adminAsApp: projectFactory('admin', 'admin_schema.graphql'),
  },
}
