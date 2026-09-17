/**
 * Organization status values, kept in sync with the `OrganizationStatus` GraphQL enum.
 * The `fetchOrganizations` mapping fails type-check if the API adds a new value.
 */
export const organizationStatusValues = ['ACTIVE', 'LOCKED'] as const

export type OrganizationStatus = (typeof organizationStatusValues)[number]

export interface Organization {
  id: string
  businessName: string
}

/**
 * Organization with every field the destinations query returns without an extra request.
 * Only the destinations fetch produces this shape, so other `Organization` consumers stay unchanged.
 */
export interface OrganizationWithDetails extends Organization {
  status: OrganizationStatus
  shopCount: number | null
  url: string
}
