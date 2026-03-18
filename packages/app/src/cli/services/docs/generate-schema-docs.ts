import {
  extractFieldsFromSpec,
  zodSchemaToFields,
  extensionSlug,
  generateAppConfigDocFile,
  generateAppConfigSectionInterface,
  generateAppConfigExampleToml,
  generateExtensionDocFile,
  generateExtensionInterfaceFile,
  generateExtensionExampleToml,
} from './schema-to-docs.js'
import {appFromIdentifiers} from '../context.js'
import {fetchSpecifications} from '../generate/fetch-extension-specifications.js'
import {AppSchema} from '../../models/app/app.js'

/* eslint-disable @nx/enforce-module-boundaries -- internal tooling, not lazy-loaded at runtime */
import {mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'
import type {AppConfigSection, MergedSpec} from './schema-to-docs.js'
/* eslint-enable @nx/enforce-module-boundaries */

/**
 * App config specs to skip in docs — these share a schema with another spec and
 * would produce duplicate sections. Their fields are already covered by the other spec.
 */
const SKIP_APP_CONFIG_SPECS = new Set([
  // Uses the same WebhooksSchema as 'webhooks'; its fields are covered by the Webhooks section
  'privacy_compliance_webhooks',
  // Branding fields (name, handle) are added to the Global section instead
  'branding',
])

/**
 * Generate TOML configuration schema documentation files.
 *
 * Authenticates via the developer platform APIs, fetches extension specifications,
 * and writes doc/interface/example files for app config and extensions.
 *
 * @param basePath - Absolute path to the output directory (e.g. `<repo>/docs-shopify.dev/configuration`)
 * @param clientId - The app client ID to authenticate with
 */
export async function generateSchemaDocs(basePath: string, clientId: string): Promise<void> {
  outputInfo('Authenticating and fetching app...')
  const app = await appFromIdentifiers({apiKey: clientId})
  const {developerPlatformClient} = app

  outputInfo('Fetching extension specifications...')
  const specs = await fetchSpecifications({
    developerPlatformClient,
    app: {apiKey: app.apiKey, organizationId: app.organizationId, id: app.id},
  })

  // Partition: single = app.toml config modules, uuid/dynamic = extension types
  const appConfigSpecs: MergedSpec[] = []
  const extensionSpecs: MergedSpec[] = []
  for (const spec of specs) {
    const merged = spec as MergedSpec
    if (merged.uidStrategy === 'single') {
      if (!SKIP_APP_CONFIG_SPECS.has(merged.identifier)) {
        appConfigSpecs.push(merged)
      }
    } else {
      extensionSpecs.push(merged)
    }
  }

  outputInfo(
    `Found ${specs.length} specifications (${appConfigSpecs.length} app config, ${extensionSpecs.length} extensions). Generating docs...`,
  )

  // Ensure output directories exist
  await mkdir(basePath)
  await mkdir(joinPath(basePath, 'interfaces'))
  await mkdir(joinPath(basePath, 'examples'))

  // --- App configuration: one consolidated page ---

  // Start with root-level fields from AppSchema (client_id, build, extension_directories, etc.)
  // Also include name and handle which are root-level app.toml fields contributed by the branding spec.
  const globalFields = [
    ...zodSchemaToFields(AppSchema),
    {name: 'name', type: 'string', required: true, description: 'The name of your app.'},
    {name: 'handle', type: 'string', required: false, description: 'The URL handle of your app.'},
  ]
  const appSections: AppConfigSection[] = [
    {
      identifier: 'global',
      externalName: 'Global',
      fields: globalFields,
    },
  ]
  outputInfo(`  App config section: global (${globalFields.length} fields)`)

  const appConfigFieldPromises = appConfigSpecs.map(async (spec) => {
    const fields = await extractFieldsFromSpec(spec)
    return {
      identifier: spec.identifier,
      externalName: spec.externalName,
      fields,
    }
  })
  const resolvedAppConfigSections = await Promise.all(appConfigFieldPromises)
  for (const section of resolvedAppConfigSections) {
    appSections.push(section)
    outputInfo(`  App config section: ${section.identifier} (${section.fields.length} fields)`)
  }

  const appDocContent = generateAppConfigDocFile(appSections)
  await writeFile(joinPath(basePath, 'app-configuration.doc.ts'), appDocContent)

  // Write one interface file per app config section
  const interfaceWrites = appSections
    .filter((section) => section.fields.length > 0)
    .map(async (section) => {
      const sectionSlug = section.identifier.replace(/_/g, '-')
      const interfaceContent = generateAppConfigSectionInterface(section)
      await writeFile(joinPath(basePath, 'interfaces', `${sectionSlug}.interface.ts`), interfaceContent)
    })
  await Promise.all(interfaceWrites)

  // Write combined app.toml example
  const appExampleContent = generateAppConfigExampleToml(appSections)
  await writeFile(joinPath(basePath, 'examples', 'app-configuration.example.toml'), appExampleContent)

  // --- Extensions: one page per extension type ---
  const extensionWrites = extensionSpecs.map(async (spec) => {
    const fields = await extractFieldsFromSpec(spec)
    const slug = extensionSlug(spec)

    const docContent = generateExtensionDocFile(spec, fields)
    await writeFile(joinPath(basePath, `${slug}.doc.ts`), docContent)

    if (fields.length > 0) {
      const interfaceContent = generateExtensionInterfaceFile(spec, fields)
      await writeFile(joinPath(basePath, 'interfaces', `${slug}.interface.ts`), interfaceContent)
    }

    const exampleContent = generateExtensionExampleToml(spec, fields)
    await writeFile(joinPath(basePath, 'examples', `${slug}.example.toml`), exampleContent)

    outputInfo(`  Extension: ${slug} (${fields.length} fields)`)
  })

  await Promise.all(extensionWrites)

  outputSuccess(
    `Generated documentation: 1 app config page (${appSections.length} sections), ${extensionSpecs.length} extension pages`,
  )
}
