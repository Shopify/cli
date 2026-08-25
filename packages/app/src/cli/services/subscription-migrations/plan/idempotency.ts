import {randomUUID, sha256} from '@shopify/cli-kit/node/crypto'
import type {MigrationAction} from '../../../models/subscription-migrations.js'

const IDEMPOTENCY_NAMESPACE = 'shopify-subscription-migration:v1'

interface DeriveBatchIdempotencyKeyOptions {
  appIdentifier: string
  action: MigrationAction
  rootKey: string
  canonicalBatchPayload: string
}

export function generateRootIdempotencyKey(): string {
  return randomUUID()
}

export function deriveBatchIdempotencyKey({
  appIdentifier,
  action,
  rootKey,
  canonicalBatchPayload,
}: DeriveBatchIdempotencyKeyOptions): string {
  const canonicalDerivationInput = JSON.stringify({
    namespace: IDEMPOTENCY_NAMESPACE,
    appIdentifier,
    action,
    rootKey,
    canonicalBatchPayload,
  })
  return sha256(canonicalDerivationInput).toString('hex')
}
