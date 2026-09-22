import {scanUnauthenticatedEndpoints} from '../rules/js-rules.js'
import {describe, expect, test} from 'vitest'
import type {SourceFile} from '../rules/types.js'

const source = (content: string): SourceFile => ({
  path: 'app/routes/orders.ts',
  absolutePath: '/app/app/routes/orders.ts',
  ext: '.ts',
  content,
})

describe('context authentication handoff', () => {
  test('requires review even when the template spelling also appears', () => {
    const result = scanUnauthenticatedEndpoints([
      source(`export async function loader({request, context}) {
  await authenticate.admin(request);
  await context.shopify.authenticate.admin(request);
  return prisma.order.findMany();
}`),
    ])

    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
    expect(result.unresolvedReason).toContain('app/routes/orders.ts')
  })

  test('does not treat an unawaited conditional context call as verified', () => {
    const result = scanUnauthenticatedEndpoints([
      source(`export async function loader({request, context}) {
  if (request.headers.get('x-check')) context
    .shopify
    .authenticate.admin(request);
  return prisma.order.findMany();
}`),
    ])

    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('ignores context call examples in comments and strings', () => {
    const result = scanUnauthenticatedEndpoints([
      source(`export async function loader({request}) {
  // await context.shopify.authenticate.admin(request);
  const example = 'context.shopify.authenticate.admin(request)';
  return prisma.order.findMany();
}`),
    ])

    expect(result.issues).toEqual([
      expect.objectContaining({id: 'UNAUTHENTICATED_ENDPOINT', location: {file: 'app/routes/orders.ts', line: 1}}),
    ])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('retains ordinary heuristic findings in other handlers', () => {
    const result = scanUnauthenticatedEndpoints([
      source(`export async function loader({request, context}) {
  await context.shopify.authenticate.admin(request);
  return prisma.order.findMany();
}
export async function action({request}) {
  return prisma.order.deleteMany();
}`),
    ])

    expect(result.issues).toEqual([
      expect.objectContaining({id: 'UNAUTHENTICATED_ENDPOINT', location: {file: 'app/routes/orders.ts', line: 5}}),
    ])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })
})
