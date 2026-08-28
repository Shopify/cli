import {loadChecks} from '../checks/index.js'
import {RULE_CATALOG, type RuleCatalogEntry} from '../rules/catalog.js'
import {DETERMINISTIC_RULES} from '../scanners/index.js'

export interface RegistryEntry {
  id: string
  version: number
  kind: 'deterministic' | 'agent'
  severity: RuleCatalogEntry['severity']
  title: string
  description: string
  points: number
  fix: string
  guide?: string
  requires?: RuleCatalogEntry['requires']
  prompt_hash?: string
}

/** The one public registry used by docs, CLI listing, review packs, and traces. */
export function getRegistry(): RegistryEntry[] {
  const catalog = new Map(RULE_CATALOG.map((entry) => [entry.id, entry]))
  const deterministic: RegistryEntry[] = DETERMINISTIC_RULES.map((rule) => {
    const entry = catalog.get(rule.id)
    if (!entry) throw new Error(`Deterministic rule ${rule.id} is missing from the rule catalog`)
    return {
      id: rule.id,
      version: rule.version,
      kind: 'deterministic',
      severity: entry.severity,
      title: entry.title,
      description: entry.description,
      points: entry.points,
      fix: entry.fix,
      ...(entry.guide ? {guide: entry.guide} : {}),
      ...(entry.requires ? {requires: entry.requires} : {}),
    }
  })
  const agent: RegistryEntry[] = [...loadChecks().values()].map((check) => {
    const entry = catalog.get(check.id)
    return {
      id: check.id,
      version: check.version,
      kind: 'agent',
      severity: check.severity as RegistryEntry['severity'],
      title:
        entry?.title ??
        check.id
          .replaceAll('_', ' ')
          .toLowerCase()
          .replace(/\b\w/g, (character) => character.toUpperCase()),
      description: entry?.description ?? "Semantic security review performed by the developer's coding agent.",
      points: entry?.points ?? 0,
      fix: entry?.fix ?? 'Review the cited evidence and correct the security boundary.',
      ...(entry?.guide ? {guide: entry.guide} : {}),
      prompt_hash: check.prompt_hash,
      ...(entry?.requires ? {requires: entry.requires} : {}),
    }
  })
  return [...deterministic, ...agent].sort((left, right) =>
    `${left.kind}|${left.id}`.localeCompare(`${right.kind}|${right.id}`),
  )
}
