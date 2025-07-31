export type OperationType = 'import' | 'export' | 'copy'

export interface CompositeIdComponents {
  operationType: OperationType
  organizationId: number
  bulkOperationId: string
}

export function serialize(components: CompositeIdComponents): string {
  const payload = `${components.operationType}:${components.organizationId}:${components.bulkOperationId}`
  return Buffer.from(payload).toString('base64')
}

export function deserialize(compositeId: string): CompositeIdComponents {
  const payload = Buffer.from(compositeId, 'base64').toString('utf-8')
  const parts = payload.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid composite ID format')
  }

  const [operationType, organizationIdStr, bulkOperationId] = parts

  if (!operationType || !['import', 'export', 'copy'].includes(operationType)) {
    throw new Error(`Invalid operation type: ${operationType}`)
  }

  if (!organizationIdStr) {
    throw new Error('Organization ID is missing')
  }

  const organizationId = parseInt(organizationIdStr, 10)
  if (isNaN(organizationId)) {
    throw new Error(`Invalid organization ID: ${organizationIdStr}`)
  }

  if (!bulkOperationId) {
    throw new Error("Bulk operation ID can't be empty")
  }

  return {
    operationType: operationType as OperationType,
    organizationId,
    bulkOperationId,
  }
}
