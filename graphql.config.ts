function projectFactory(name: string, schemaName: string) {
  return {
    schema: `./packages/app/src/cli/api/graphql/${name}/${schemaName}`,
    documents: [`./packages/app/src/cli/api/graphql/${name}/queries/**/*.graphql`],
    extensions: {
      codegen: {
        generates: {
          [`./packages/app/src/cli/api/graphql/${name}/generated/types.d.ts`]: {
            plugins: [
              {'graphql-codegen-typescript-operation-types': {enumsAsTypes: true, useTypeImports: true}},
              {
                add: {
                  content:
                    '/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any, tsdoc/syntax  */',
                },
              },
            ],
            config: {
              omitObjectTypes: true,
              scalars: {
                GlobalID: 'string',
                PropertyId: 'string',
                PropertyPublicID: 'string',
              },
            },
          },
          [`./packages/app/src/cli/api/graphql/${name}/generated/`]: {
            preset: 'near-operation-file',
            plugins: [
              {
                add: {
                  content:
                    '/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention, @typescript-eslint/ban-types */',
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
                  },
                },
              },
              {
                'typed-document-node': {
                  addTypenameToSelectionSets: true,
                  nameSuffix: 'Funky',
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
  },
}
