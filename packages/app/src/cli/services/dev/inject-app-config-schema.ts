import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {RemoteAwareExtensionSpecification} from '../../models/extensions/specification.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {fileExists, readFile, writeFile, unlinkFile, mkdir} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath, relativePath} from '@shopify/cli-kit/node/path'

export async function injectAppConfigSchema(
  appConfigPath: string,
  _developerPlatformClient: DeveloperPlatformClient,
  appDirectoryPath: string,
  specs: RemoteAwareExtensionSpecification[],
) {
  const schemaLocation = joinPath(appDirectoryPath, '.shopify', 'app-schemas', 'app-config.schema.json')

  if (await fileExists(schemaLocation)) {
    // remove it, we'll regenerate it
    await unlinkFile(schemaLocation)
  }

  const jsonSchemas = specs
    .filter((spec) => spec.uidStrategy === 'single')
    .map((spec) => spec as unknown as RemoteSpecification)
    .map((spec) => spec.validationSchema)
    .filter((validationSchema) => validationSchema !== undefined && validationSchema !== null)
    .map((validationSchema) => validationSchema.jsonSchema)
    .filter((schema) => schema !== undefined)

  const initial = {
    type: 'object',
    additionalProperties: true,
    properties: {
      client_id: {
        type: 'string',
        description: 'The unique identifier for the app',
      },
    },
    definitions: {},
  }

  const masterSchema = jsonSchemas.reduce((combined, jsonSchema) => {
    return {
      ...combined,
      properties: {
        ...combined.properties,
        ...JSON.parse(jsonSchema).properties,
      },
      definitions: {
        ...combined.definitions,
        ...JSON.parse(jsonSchema).definitions,
      },
    }
  }, initial)

  await mkdir(joinPath(appDirectoryPath, '.shopify', 'app-schemas'))
  await writeFile(schemaLocation, JSON.stringify(masterSchema, null, 2))

  const fileContents = await readFile(appConfigPath)
  if (fileContents.includes('#:schema')) {
    return
  }

  const relativeSchemaLocation = relativePath(dirname(appConfigPath), schemaLocation)
  const schemaDirective = `#:schema ${relativeSchemaLocation}\n`
  const newFileContents = schemaDirective + fileContents
  await writeFile(appConfigPath, newFileContents)
}
