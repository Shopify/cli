import {watchMigrationOperations} from './watch-operations.js'
import {outputContent, outputResult} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'
import type {MigrationOperation} from '../../models/subscription-migrations.js'

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')

function operation(id: string, status: MigrationOperation['status']): MigrationOperation {
  return {id, status, total: 2, results: {edges: []}}
}

describe('watchMigrationOperations', () => {
  test('renders every polling update on stderr and returns the final operations', async () => {
    const running = operation('one', 'RUNNING')
    const completed = {...operation('one', 'COMPLETED'), results: {edges: []}}
    const updateStatus = vi.fn()
    const waitForOperations = vi.fn(async ({onUpdate}: {onUpdate?: (operations: MigrationOperation[]) => void}) => {
      onUpdate?.([running])
      onUpdate?.([completed])
      return [completed]
    })
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(updateStatus))

    await expect(
      watchMigrationOperations({
        clientId: 'client-id',
        operationIds: ['one'],
        waitForOperations,
      }),
    ).resolves.toEqual([completed])

    expect(renderSingleTask).toHaveBeenCalledOnce()
    expect(renderSingleTask).toHaveBeenCalledWith({
      title: outputContent`Polling subscription migration operations`,
      task: expect.any(Function),
      renderOptions: {stdout: process.stderr},
    })
    expect(waitForOperations).toHaveBeenCalledWith({
      clientId: 'client-id',
      operationIds: ['one'],
      onUpdate: expect.any(Function),
    })
    expect(updateStatus).toHaveBeenNthCalledWith(1, outputContent`one: RUNNING (0/2 settled)`)
    expect(updateStatus).toHaveBeenNthCalledWith(2, outputContent`one: COMPLETED (0/2 settled)`)
    expect(outputResult).not.toHaveBeenCalled()
  })
})
