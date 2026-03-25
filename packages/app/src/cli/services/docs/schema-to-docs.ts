// eslint-disable-next-line @nx/enforce-module-boundaries -- internal tooling command, not lazy-loaded at runtime
import {normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'
import {zodToJsonSchema} from 'zod-to-json-schema'
import type {FlattenedRemoteSpecification} from '../../api/graphql/extension_specifications.js'
import type {RemoteAwareExtensionSpecification} from '../../models/extensions/specification.js'

/**
 * Represents a single field extracted from a JSON Schema.
 */
interface SchemaField {
  name: string
  type: string
  description?: string
  required: boolean
  enumValues?: string[]
  nested?: SchemaField[]
  isArray?: boolean
  arrayItemType?: string
}

/**
 * A section in the consolidated app.toml doc — one per config module spec.
 */
export interface AppConfigSection {
  identifier: string
  externalName: string
  fields: SchemaField[]
}

export type MergedSpec = RemoteAwareExtensionSpecification & FlattenedRemoteSpecification

// ---------------------------------------------------------------------------
// JSON Schema walker
// ---------------------------------------------------------------------------

interface JsonSchemaProperty {
  type?: string | string[]
  description?: string
  enum?: unknown[]
  properties?: Record<string, JsonSchemaProperty>
  items?: JsonSchemaProperty
  required?: string[]
  anyOf?: JsonSchemaProperty[]
  oneOf?: JsonSchemaProperty[]
  allOf?: JsonSchemaProperty[]
  const?: unknown
  default?: unknown
  $ref?: string
}

/**
 * Walk a dereferenced JSON Schema object and extract fields.
 */
function jsonSchemaToFields(schema: JsonSchemaProperty, parentRequired?: string[]): SchemaField[] {
  const properties = schema.properties
  if (!properties) return []

  const requiredSet = new Set(schema.required ?? parentRequired ?? [])

  return Object.entries(properties).map(([name, prop]) => {
    const resolvedProp = resolveComposite(prop)
    const field: SchemaField = {
      name,
      type: resolveType(resolvedProp),
      description: resolvedProp.description,
      required: requiredSet.has(name),
    }

    if (resolvedProp.enum) {
      field.enumValues = resolvedProp.enum.map(String)
    }

    if (resolvedProp.type === 'array' && resolvedProp.items) {
      field.isArray = true
      const itemResolved = resolveComposite(resolvedProp.items)
      field.arrayItemType = resolveType(itemResolved)
      if (itemResolved.properties) {
        field.nested = jsonSchemaToFields(itemResolved)
      }
    }

    if (resolvedProp.type === 'object' && resolvedProp.properties) {
      field.nested = jsonSchemaToFields(resolvedProp)
    }

    return field
  })
}

function resolveComposite(prop: JsonSchemaProperty): JsonSchemaProperty {
  // Merge allOf schemas
  if (prop.allOf && prop.allOf.length > 0) {
    let merged: JsonSchemaProperty = {}
    for (const sub of prop.allOf) {
      merged = {
        ...merged,
        ...sub,
        properties: {...(merged.properties ?? {}), ...(sub.properties ?? {})},
        required: [...(merged.required ?? []), ...(sub.required ?? [])],
      }
    }
    return {...prop, ...merged, allOf: undefined}
  }
  // For anyOf/oneOf, pick the first non-null branch
  const union = prop.anyOf ?? prop.oneOf
  if (union && union.length > 0) {
    const nonNull = union.filter((branch) => branch.type !== 'null')
    if (nonNull.length > 0) return {...prop, ...(nonNull[0] ?? {}), anyOf: undefined, oneOf: undefined}
  }
  return prop
}

function resolveType(prop: JsonSchemaProperty): string {
  if (prop.const !== undefined) return 'const'
  if (Array.isArray(prop.type)) {
    const nonNull = prop.type.filter((t) => t !== 'null')
    return nonNull[0] ?? 'unknown'
  }
  return prop.type ?? 'unknown'
}

// ---------------------------------------------------------------------------
// Zod → JSON Schema conversion (via zod-to-json-schema)
// ---------------------------------------------------------------------------

/**
 * Convert a Zod schema to SchemaFields by first converting it to JSON Schema
 * using zod-to-json-schema, then walking the result with jsonSchemaToFields.
 *
 * This avoids brittle introspection of Zod's internal `_def` structure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodSchemaToFields(schema: any): SchemaField[] {
  const converted = zodToJsonSchema(schema, {$refStrategy: 'none', effectStrategy: 'input'})
  return jsonSchemaToFields(converted as unknown as JsonSchemaProperty)
}

// ---------------------------------------------------------------------------
// Schema field extraction from a spec (priority: JSON Schema contract > Zod)
// ---------------------------------------------------------------------------

/**
 * Fields from the base extension schema that every JSON Schema contract includes.
 * These are internal extension framework fields that users never write in app.toml.
 * We strip these from app config specs (uidStrategy === 'single') since only the
 * module-specific fields are relevant to the app.toml reference.
 *
 * Note: 'name' and 'handle' are also excluded here because they come from BaseSchema.
 * The branding spec contributes them, but they are root-level app.toml fields —
 * they should appear in the Global section instead (added by the command).
 */
const BASE_EXTENSION_SCHEMA_FIELDS = new Set([
  'name',
  'type',
  'handle',
  'uid',
  'description',
  'api_version',
  'extension_points',
  'capabilities',
  'supported_features',
  'settings',
])

export async function extractFieldsFromSpec(spec: MergedSpec): Promise<SchemaField[]> {
  const isAppConfig = spec.uidStrategy === 'single'

  // 1. Try JSON Schema contract from the platform API
  if (spec.validationSchema?.jsonSchema) {
    try {
      const normalised = await normaliseJsonSchema(spec.validationSchema.jsonSchema)
      let fields = jsonSchemaToFields(normalised as unknown as JsonSchemaProperty)
      if (isAppConfig) {
        fields = fields.filter((field) => !BASE_EXTENSION_SCHEMA_FIELDS.has(field.name))
      }
      if (fields.length > 0) return fields
    } catch (error) {
      // Fall through to Zod — contract may be malformed or have unresolvable $refs
      if (error instanceof SyntaxError || (error as {code?: string}).code === 'ENOENT') {
        throw error
      }
    }
  }

  // 2. Fall back to Zod schema → JSON Schema conversion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zodSchema = (spec as any).schema
  if (zodSchema) {
    let fields = zodSchemaToFields(zodSchema)
    if (isAppConfig) {
      fields = fields.filter((field) => !BASE_EXTENSION_SCHEMA_FIELDS.has(field.name))
    }
    return fields
  }

  return []
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extensionSlug(spec: MergedSpec): string {
  return spec.identifier.replace(/_/g, '-')
}

// Used to avoid generating `interface function { ... }` or `interface export { ... }` which would be
// syntax errors. Extension slugs like "function" are real spec identifiers. Interface keys are already
// quoted ('key': type) so they don't need this check — only the interface name itself does.
const JS_RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'finally',
  'for',
  'function',
  'if',
  'in',
  'instanceof',
  'new',
  'return',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'class',
  'const',
  'enum',
  'export',
  'extends',
  'import',
  'super',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
])

function interfaceName(slug: string): string {
  const name = slug.replace(/-/g, '')
  // Avoid JS reserved words as interface names
  if (JS_RESERVED_WORDS.has(name)) return `${name}Config`
  return name
}

function tsTypeForField(field: SchemaField): string {
  if (field.enumValues) {
    return field.enumValues.map((val) => `'${escapeSingleQuotes(val)}'`).join(' | ')
  }
  if (field.isArray && field.nested) {
    return `${interfaceName(field.name)}Item[]`
  }
  if (field.isArray) {
    return `${field.arrayItemType ?? 'string'}[]`
  }
  if (field.nested) {
    return interfaceName(field.name)
  }
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    object: 'object',
    const: 'string',
    any: 'unknown',
    unknown: 'unknown',
  }
  return typeMap[field.type] ?? 'unknown'
}

function escapeSingleQuotes(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// ---------------------------------------------------------------------------
// Consolidated app.toml doc — one page with a section per config module
// ---------------------------------------------------------------------------

/**
 * Generate the single .doc.ts for the entire app.toml reference.
 * Each config module becomes a `definitions` entry (section on the page).
 */
export function generateAppConfigDocFile(sections: AppConfigSection[]): string {
  const definitionsEntries = sections
    .filter((section) => section.fields.length > 0)
    .map((section) => {
      const sectionSlug = section.identifier.replace(/_/g, '-')
      const iface = interfaceName(sectionSlug)
      return `  {
    title: '${escapeSingleQuotes(section.externalName)}',
    description: '${escapeSingleQuotes(section.externalName)} properties.',
    type: '${iface}',
  },`
    })
    .join('\n')

  return `// This is an autogenerated file. Don't edit this file manually.
import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: 'App configuration',
  description: 'Reference for the shopify.app.toml configuration file.',
  overviewPreviewDescription: 'shopify.app.toml configuration reference.',
  type: 'resource',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'shopify.app.toml',
          code: './examples/app-configuration.example.toml',
          language: 'toml',
        },
      ],
      title: 'Example configuration',
    },
  },
  definitions: [
${definitionsEntries}
  ],
  category: 'app-configuration',
  related: [],
}

export default data`
}

/**
 * Generate the interface file for one config module section of app.toml.
 */
export function generateAppConfigSectionInterface(section: AppConfigSection): string {
  const sectionSlug = section.identifier.replace(/_/g, '-')
  const iface = interfaceName(sectionSlug)
  return generateInterfaceContent(iface, section.fields)
}

/**
 * Generate a combined example TOML for the entire app.toml.
 */
export function generateAppConfigExampleToml(sections: AppConfigSection[]): string {
  const lines: string[] = []

  for (const section of sections) {
    if (section.fields.length === 0) continue
    lines.push(`# ${section.externalName}`)
    emitTomlFields(section.fields, '', lines)
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

// ---------------------------------------------------------------------------
// Extension TOML doc — one page per extension type
// ---------------------------------------------------------------------------

export function generateExtensionDocFile(spec: MergedSpec, fields: SchemaField[]): string {
  const slug = extensionSlug(spec)
  const name = spec.externalName
  const iface = interfaceName(slug)

  const hasFields = fields.length > 0
  const definitionsBlock = hasFields
    ? `
  {
    title: 'Properties',
    description: 'The following properties are available:',
    type: '${iface}',
  },`
    : ''

  return `// This is an autogenerated file. Don't edit this file manually.
import {ReferenceEntityTemplateSchema} from '@shopify/generate-docs'

const data: ReferenceEntityTemplateSchema = {
  name: '${escapeSingleQuotes(name)}',
  description: 'Configuration reference for ${escapeSingleQuotes(name)}.',
  overviewPreviewDescription: '${escapeSingleQuotes(name)} TOML configuration.',
  type: 'resource',
  isVisualComponent: false,
  defaultExample: {
    codeblock: {
      tabs: [
        {
          title: 'shopify.extension.toml',
          code: './examples/${slug}.example.toml',
          language: 'toml',
        },
      ],
      title: 'Example configuration',
    },
  },
  definitions: [${definitionsBlock}
  ],
  category: 'extension-configuration',
  related: [],
}

export default data`
}

export function generateExtensionInterfaceFile(spec: MergedSpec, fields: SchemaField[]): string {
  const slug = extensionSlug(spec)
  const iface = interfaceName(slug)
  return generateInterfaceContent(iface, fields)
}

export function generateExtensionExampleToml(spec: MergedSpec, fields: SchemaField[]): string {
  const lines: string[] = []
  lines.push(`name = "${spec.externalName}"`)
  lines.push(`type = "${spec.identifier}"`)
  lines.push('')
  emitTomlFields(fields, '', lines, new Set(['name', 'type', 'handle']))
  return `${lines.join('\n').trim()}\n`
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Flatten fields into a single interface with dot-notation keys for nested properties.
 * generate-docs renders one flat interface as a properties table — it doesn't recurse
 * into sub-interfaces, so we need to flatten everything.
 *
 * Example output:
 *   'client_id': string
 *   'build.automatically_update_urls_on_dev'?: boolean
 *   'access_scopes.scopes'?: string
 */
function generateInterfaceContent(iface: string, fields: SchemaField[]): string {
  const flatLines = flattenFields(fields, '')

  const mainInterface = `export interface ${iface} {\n${flatLines.join('\n\n')}\n}`
  return `// This is an autogenerated file. Don't edit this file manually.\n${mainInterface}\n`
}

function flattenFields(fields: SchemaField[], prefix: string): string[] {
  const lines: string[] = []
  for (const field of fields) {
    const key = prefix ? `${prefix}.${field.name}` : field.name
    if (field.nested && field.nested.length > 0 && !field.isArray) {
      // Nested object: recurse, don't emit the parent as its own row
      lines.push(...flattenFields(field.nested, key))
    } else if (field.isArray && field.nested && field.nested.length > 0) {
      // Array of objects: emit parent as array, then flatten items with [] notation
      const desc = field.description ? `  /** ${field.description} */\n` : ''
      const optional = field.required ? '' : '?'
      lines.push(`${desc}  '${key}'${optional}: object[]`)
      lines.push(...flattenFields(field.nested, `${key}[]`))
    } else {
      const desc = field.description ? `  /** ${field.description} */\n` : ''
      const optional = field.required ? '' : '?'
      const tsType = tsTypeForField(field)
      lines.push(`${desc}  '${key}'${optional}: ${tsType}`)
    }
  }
  return lines
}

/**
 * Recursively emit TOML fields. Handles nested objects as [table] headers,
 * arrays of objects as [[array_of_tables]], and skips opaque objects without children.
 *
 * TOML requires all bare key=value pairs for a scope to appear before any [sub.table]
 * headers, and all table headers must be fully qualified.
 */
function emitTomlFields(fields: SchemaField[], prefix: string, lines: string[], skipNames?: Set<string>): void {
  // Partition: scalar/leaf fields first, then nested objects, then arrays of objects
  const scalarFields: SchemaField[] = []
  const nestedObjects: SchemaField[] = []
  const arrayTables: SchemaField[] = []

  for (const field of fields) {
    if (skipNames?.has(field.name)) continue
    if (field.type === 'object' && !field.nested) {
      // Opaque object with no known children — skip
      continue
    } else if (field.nested && field.nested.length > 0 && field.type === 'object' && !field.isArray) {
      nestedObjects.push(field)
    } else if (field.isArray && field.nested && field.nested.length > 0) {
      arrayTables.push(field)
    } else {
      scalarFields.push(field)
    }
  }

  // 1. Emit scalar key=value pairs first (must come before any [table] headers)
  for (const field of scalarFields) {
    lines.push(`${field.name} = ${exampleValue(field)}`)
  }

  // 2. Emit nested object tables with fully qualified paths
  for (const field of nestedObjects) {
    const key = prefix ? `${prefix}.${field.name}` : field.name
    lines.push(`[${key}]`)
    emitTomlFields(field.nested!, key, lines)
    lines.push('')
  }

  // 3. Emit arrays of tables with fully qualified paths
  for (const field of arrayTables) {
    const key = prefix ? `${prefix}.${field.name}` : field.name
    lines.push(`[[${key}]]`)
    emitTomlFields(field.nested!, key, lines)
    lines.push('')
  }
}

function exampleValue(field: SchemaField): string {
  if (field.enumValues && field.enumValues.length > 0) {
    return `"${field.enumValues[0]}"`
  }
  if (field.isArray) {
    return `["example"]`
  }
  switch (field.type) {
    case 'string':
      return `"example"`
    case 'number':
    case 'integer':
      return '0'
    case 'boolean':
      return 'true'
    default:
      return `"example"`
  }
}
