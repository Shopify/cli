export type E2EResourceType = 'app' | 'store'

export interface E2EResourceFilter {
  pattern: string
  olderThanHours?: number
  now?: number
}

interface E2EResourceOwnership {
  createdAt: number
}

const CURRENT_RUN_SEGMENT = '(r[0-9a-z]+a[1-9][0-9]*|local)'
const BASE36_TIMESTAMP = '([0-9a-z]+)'
const CURRENT_APP_PREFIX = '(?:dep1|dep2|dev|scaf|exto|extg|hrel|hcrt|hdel|mcfg|mdef|tdep|tdev)'
const CURRENT_APP_NAME = new RegExp(`^E2E-${CURRENT_APP_PREFIX}-${CURRENT_RUN_SEGMENT}-${BASE36_TIMESTAMP}$`, 'i')
const CURRENT_STORE_NAME = new RegExp(`^e2e-w[0-9]+-${CURRENT_RUN_SEGMENT}-${BASE36_TIMESTAMP}$`, 'i')
const LEGACY_APP_NAME =
  /^E2E-(?:deploy1|deploy2|dev|scaffold|ext-only|ext-gen|hot-reload|hot-create|hot-delete|multi-cfg|mcfg-def|toml-deploy|toml-dev)-(\d{13})$/i
const LEGACY_STORE_NAME = /^e2e-w[0-9]+-(\d{13})$/i
const MINIMUM_E2E_TIMESTAMP = Date.UTC(2020, 0, 1)

export function matchesOwnedE2EResource(
  resourceType: E2EResourceType,
  resourceName: string,
  filter: E2EResourceFilter,
): boolean {
  if (filter.olderThanHours !== undefined && (!Number.isFinite(filter.olderThanHours) || filter.olderThanHours <= 0)) {
    throw new Error('olderThanHours must be greater than zero')
  }

  const ownership = parseE2EResourceOwnership(resourceType, resourceName)
  if (!ownership || !resourceName.toLowerCase().includes(filter.pattern.toLowerCase())) return false
  if (filter.olderThanHours === undefined) return true

  const oldestAllowedCreationTime = (filter.now ?? Date.now()) - filter.olderThanHours * 60 * 60 * 1000
  return ownership.createdAt <= oldestAllowedCreationTime
}

function parseE2EResourceOwnership(
  resourceType: E2EResourceType,
  resourceName: string,
): E2EResourceOwnership | undefined {
  const currentMatch = resourceName.match(resourceType === 'app' ? CURRENT_APP_NAME : CURRENT_STORE_NAME)
  if (currentMatch?.[1] && currentMatch[2]) {
    const createdAt = parseTimestamp(currentMatch[2])
    if (createdAt !== undefined) return {createdAt}
  }

  const legacyMatch = resourceName.match(resourceType === 'app' ? LEGACY_APP_NAME : LEGACY_STORE_NAME)
  if (legacyMatch?.[1]) {
    const createdAt = parseTimestamp(legacyMatch[1])
    if (createdAt !== undefined) return {createdAt}
  }

  return undefined
}

function parseTimestamp(timestampSegment: string): number | undefined {
  const timestamp = /^\d{13}$/.test(timestampSegment) ? Number(timestampSegment) : parseInt(timestampSegment, 36)
  return Number.isSafeInteger(timestamp) && timestamp >= MINIMUM_E2E_TIMESTAMP ? timestamp : undefined
}
