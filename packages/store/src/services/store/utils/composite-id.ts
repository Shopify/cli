export interface CompositeIdComponents {
  organizationId: string
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

  const [organizationId, bulkDataOperationId] = parts

  if (!organizationId) {
    throw new Error('Organization ID is missing')
  }

  if (!bulkDataOperationId) {
    throw new Error("Bulk operation ID can't be empty")
  }

  return {
    organizationId,
    bulkDataOperationId,
  }
}
