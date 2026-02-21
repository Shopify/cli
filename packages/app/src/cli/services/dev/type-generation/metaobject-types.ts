import {fileExistsSync, readFileSync, removeFileSync, writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

const TYPE_FILE_NAME = 'app-bridge.d.ts'

interface MetaobjectField {
  type: string
}

interface MetaobjectDefinition {
  fields: Record<string, string | MetaobjectField>
}

interface MetaobjectsConfig {
  app?: Record<string, MetaobjectDefinition>
}

interface AppConfiguration {
  metaobjects?: MetaobjectsConfig
}

/**
 * Maps a TOML field type to its TypeScript equivalent
 */
export function mapFieldTypeToTypeScript(fieldType: string): string {
  if (fieldType === 'single_line_text_field' || fieldType === 'multi_line_text_field') {
    return 'string'
  }
  if (fieldType.startsWith('metaobject_reference<')) {
    return 'string'
  }
  return 'any'
}

/**
 * Extracts metaobjects configuration from the app configuration
 */
export function extractMetaobjectsConfig(configuration: object): MetaobjectsConfig | undefined {
  const config = configuration as AppConfiguration
  return config.metaobjects
}

/**
 * Generates TypeScript type definitions from metaobjects configuration
 * Returns undefined if there are no metaobjects defined
 */
export function generateMetaobjectTypeDefinitions(metaobjects: MetaobjectsConfig | undefined): string | undefined {
  if (!metaobjects?.app) {
    return undefined
  }

  const appMetaobjects = metaobjects.app
  const typeNames = Object.keys(appMetaobjects)

  if (typeNames.length === 0) {
    return undefined
  }

  const typeEntries = typeNames.map((typeName) => {
    const definition = appMetaobjects[typeName]!
    const fields = definition.fields
    const fieldEntries = Object.entries(fields).map(([fieldName, fieldConfig]) => {
      const fieldType = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.type
      const tsType = mapFieldTypeToTypeScript(fieldType)
      return `${fieldName}: ${tsType}`
    })
    return `      "$app:${typeName}": { ${fieldEntries.join('; ')} }`
  })

  return `declare global {
  interface ShopifyGlobalOverrides {
    metaobjectTypes: {
${typeEntries.join(';\n')};
    }
  }
}
export {}
`
}

/**
 * Main entry point - handles everything: extraction, generation, file writing
 * app.ts just calls this with raw config and directory
 */
export async function generateMetaobjectTypes(configuration: object, appDirectory: string): Promise<void> {
  const typeFilePath = joinPath(appDirectory, TYPE_FILE_NAME)
  const metaobjects = extractMetaobjectsConfig(configuration)
  const typeContent = generateMetaobjectTypeDefinitions(metaobjects)

  // No metaobjects defined - remove the file if it exists
  if (typeContent === undefined) {
    if (fileExistsSync(typeFilePath)) {
      removeFileSync(typeFilePath)
    }
    return
  }

  // Check if content has changed before writing
  if (fileExistsSync(typeFilePath)) {
    const existingContent = readFileSync(typeFilePath).toString()
    if (existingContent === typeContent) {
      return
    }
  }

  writeFileSync(typeFilePath, typeContent)
}
