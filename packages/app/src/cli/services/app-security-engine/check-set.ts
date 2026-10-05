import {defaultCheckSet} from '@shopify/app-security-checks'
import type {AppSecurityCheckSet, DeterministicCheckDefinition} from '@shopify/app-security-checks'

/** Change this dependency or pass another set to createAppSecurityEngine to replace the checks, not the workflow. */
export {defaultCheckSet}
export type {AppSecurityCheckSet, DeterministicCheckDefinition} from '@shopify/app-security-checks'

/** The host rejects unsupported contracts and ambiguous runner identities before executing package code. */
export function deterministicChecks(checkSet: AppSecurityCheckSet): ReadonlyMap<string, DeterministicCheckDefinition> {
  if (checkSet.contractVersion !== 1) throw new Error('Unsupported App Security check-set contract version.')
  const catalogIds = new Set<string>()
  for (const entry of checkSet.catalog) {
    if (catalogIds.has(entry.id)) throw new Error(`Duplicate stable product ID: ${entry.id}`)
    catalogIds.add(entry.id)
  }
  const checks = new Map<string, DeterministicCheckDefinition>()
  for (const definition of checkSet.deterministic) {
    if (checks.has(definition.id)) throw new Error(`Duplicate deterministic stable ID: ${definition.id}`)
    if (!catalogIds.has(definition.id)) throw new Error(`Orphan deterministic runner: ${definition.id}`)
    if (!Number.isInteger(definition.version) || definition.version < 1)
      throw new Error(`Invalid deterministic check version: ${definition.id}`)
    if (definition.lifecycle === 'active' && typeof definition.runner !== 'function')
      throw new Error(`Active deterministic check has no runner: ${definition.id}`)
    if (definition.lifecycle !== 'active' && definition.runner)
      throw new Error(`A non-active deterministic check can't have a runner: ${definition.id}`)
    checks.set(definition.id, definition)
  }
  return checks
}
