import * as toml from '@iarna/toml'

type TomlTable = Parameters<typeof toml.stringify>[0]

function isTomlTable(value: unknown): value is TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

function mergeTomlTables(base: TomlTable, overlay: TomlTable): TomlTable {
  const merged: TomlTable = {...base}
  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = merged[key]
    merged[key] =
      isTomlTable(baseValue) && isTomlTable(overlayValue) ? mergeTomlTables(baseValue, overlayValue) : overlayValue
  }
  return merged
}

export function mergeFixtureToml(generatedTomlContent: string, fixtureTomlContent: string, name: string): string {
  const generated = toml.parse(generatedTomlContent)
  const clientId = generated.client_id as string | undefined
  if (!clientId) {
    throw new Error('Could not find client_id in generated shopify.app.toml')
  }

  const fixture = toml.parse(fixtureTomlContent)

  return toml.stringify(mergeTomlTables(generated, {...fixture, client_id: clientId, name}))
}
