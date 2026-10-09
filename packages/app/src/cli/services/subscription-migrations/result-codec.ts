import type {MigrationOperation} from '../../models/subscription-migrations.js'
import type {MigrationUserError} from './partners-api.js'

export function projectMigrationOperation(operation: MigrationOperation) {
  return {
    gid: operation.id,
    status: operation.status,
    total: operation.total,
    results: operation.results.edges.map(({node}) => ({shopGid: node.shopId, code: node.code})),
  }
}

export function projectMigrationUserErrors(errors: MigrationUserError[]) {
  return errors.map(({message, field}) => ({message, fieldPath: field}))
}
