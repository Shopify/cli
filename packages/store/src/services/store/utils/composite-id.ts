export interface CompositeIdComponents {
  organizationId: number
  bulkDataOperationId: string
}

export function serialize(components: CompositeIdComponents): string {
  const payload = `${components.organizationId}:${components.bulkDataOperationId}`
  return Buffer.from(payload).toString('base64')
}

export function deserialize(compositeId: string): CompositeIdComponents {
  const payload = Buffer.from(compositeId, 'base64').toString('utf-8')
  const parts = payload.split(':')

  if (parts.length !== 2) {
    throw new Error('Invalid composite ID format')
  }

  const [organizationIdStr, bulkDataOperationId] = parts

  if (!organizationIdStr) {
    throw new Error('Organization ID is missing')
  }

  const organizationId = parseInt(organizationIdStr, 10)
  if (isNaN(organizationId)) {
    throw new Error(`Invalid organization ID: ${organizationIdStr}`)
  }

  if (!bulkDataOperationId) {
    throw new Error("Bulk operation ID can't be empty")
  }

  return {
    organizationId,
    bulkDataOperationId,
  }
}
