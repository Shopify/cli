import {loadChecks} from '../checks/index.js'
import {RULE_CATALOG, type RuleCatalogEntry} from '../rules/catalog.js'
import {DETERMINISTIC_CHECKS, type DeterministicCheckDefinition} from '../scanners/index.js'

export type ImplementationProvenance = 'deterministic' | 'agent'

export interface RegistryEntry {
  id: string
  version: number
  kind: ImplementationProvenance
  status: 'active' | 'planned' | 'investigate'
  severity: RuleCatalogEntry['severity']
  title: string
  description: string
  points: number
  fix: string
  guide?: string
  requires?: RuleCatalogEntry['requires']
  prompt_hash?: string
}

interface RegistryInvariantInput {
  catalog: ReadonlyArray<RuleCatalogEntry>
  deterministic: ReadonlyArray<DeterministicCheckDefinition>
  agent: ReadonlyArray<{id: string; version: number; prompt_hash: string}>
}

/** Assert identities before they are exposed or executed. */
export function assertRegistryInvariants(input: RegistryInvariantInput): void {
  const catalogIds = new Set<string>()
  for (const entry of input.catalog) {
    if (catalogIds.has(entry.id)) throw new Error(`Duplicate stable product ID: ${entry.id}`)
    catalogIds.add(entry.id)
  }

  const implementationIds = new Set<string>()
  for (const definition of input.deterministic) {
    const key = `deterministic:${definition.id}`
    if (implementationIds.has(key)) throw new Error(`Duplicate deterministic stable ID: ${definition.id}`)
    implementationIds.add(key)
    if (!catalogIds.has(definition.id)) throw new Error(`Orphan deterministic runner: ${definition.id}`)
    if (definition.lifecycle === 'active' && !definition.runner)
      throw new Error(`Active deterministic check has no runner: ${definition.id}`)
    if (definition.lifecycle !== 'active' && definition.runner)
      throw new Error(`A non-active deterministic check can't have a runner: ${definition.id}`)
  }
  for (const check of input.agent) {
    const key = `agent:${check.id}`
    if (implementationIds.has(key)) throw new Error(`Duplicate agent stable ID: ${check.id}`)
    implementationIds.add(key)
    if (!catalogIds.has(check.id)) throw new Error(`Orphan agent implementation: ${check.id}`)
    const deterministic = input.deterministic.find((definition) => definition.id === check.id)
    if (deterministic && deterministic.version !== check.version)
      throw new Error(`Deterministic and agent versions differ for shared product ID: ${check.id}`)
  }

  const implementedProducts = new Set([
    ...input.deterministic.map((definition) => definition.id),
    ...input.agent.map((check) => check.id),
  ])
  for (const entry of input.catalog) {
    if ((entry.status ?? 'active') === 'active' && !implementedProducts.has(entry.id))
      throw new Error(`Active check has no implementation: ${entry.id}`)
    if ((entry.status === 'planned' || entry.status === 'investigate') && implementedProducts.has(entry.id))
      throw new Error(`Non-active check has an executable implementation: ${entry.id}`)
  }
}

/** The public registry preserves a shared product ID and explicit provenance. */
export function getRegistry(): RegistryEntry[] {
  const checks = [...loadChecks().values()]
  const deterministicChecks = [...DETERMINISTIC_CHECKS.values()]
  assertRegistryInvariants({catalog: RULE_CATALOG, deterministic: deterministicChecks, agent: checks})
  const catalog = new Map(RULE_CATALOG.map((entry) => [entry.id, entry]))
  const deterministic: RegistryEntry[] = deterministicChecks.map((definition) => {
    const entry = catalog.get(definition.id)!
    return registryEntry(entry, {
      version: definition.version,
      kind: 'deterministic',
      status: definition.lifecycle,
    })
  })
  const agent: RegistryEntry[] = checks.map((check) => {
    const entry = catalog.get(check.id)!
    return registryEntry(entry, {
      version: check.version,
      kind: 'agent',
      status: 'active',
      prompt_hash: check.prompt_hash,
    })
  })
  return [...deterministic, ...agent].sort((left, right) =>
    `${left.id}|${left.kind}`.localeCompare(`${right.id}|${right.kind}`),
  )
}

function registryEntry(
  entry: RuleCatalogEntry,
  implementation: Pick<RegistryEntry, 'version' | 'kind' | 'status'> & {prompt_hash?: string},
): RegistryEntry {
  return {
    id: entry.id,
    ...implementation,
    severity: entry.severity,
    title: entry.title,
    description: entry.description,
    points: implementation.status === 'active' ? entry.points : 0,
    fix: entry.fix,
    ...(entry.guide ? {guide: entry.guide} : {}),
    ...(entry.requires ? {requires: entry.requires} : {}),
  }
}
