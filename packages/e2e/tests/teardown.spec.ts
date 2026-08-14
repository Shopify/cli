import {runTeardown} from '../setup/teardown-orchestrator.js'
import {expect, test} from '@playwright/test'
import type {AppDeletionReadiness, CleanupPhaseRecord} from '../setup/teardown-orchestrator.js'

test.describe('teardown orchestration', () => {
  test('deletes a store-backed app in the required order', async () => {
    const calls: string[] = []
    const records: CleanupPhaseRecord[] = []

    await runTeardown({
      hasStore: true,
      uninstallApp: async () => {
        calls.push('uninstall-app')
      },
      waitForAppDeletionReadiness: async () => {
        calls.push('wait-for-zero-installs')
        return readyApp()
      },
      deleteApp: async () => {
        calls.push('delete-app')
        return true
      },
      deleteStore: async () => {
        calls.push('delete-store')
        return true
      },
      record: (record) => records.push(record),
    })

    expect(calls).toEqual(['uninstall-app', 'wait-for-zero-installs', 'delete-app', 'delete-store'])
    expect(records.map(({phase, status}) => ({phase, status}))).toEqual([
      {phase: 'uninstall-app', status: 'completed'},
      {phase: 'wait-for-zero-installs', status: 'completed'},
      {phase: 'delete-app', status: 'completed'},
      {phase: 'delete-store', status: 'completed'},
    ])
  })

  test('does not delete the store when app deletion fails', async () => {
    const calls: string[] = []
    const records: CleanupPhaseRecord[] = []

    await runTeardown({
      hasStore: true,
      uninstallApp: async () => {},
      waitForAppDeletionReadiness: async () => readyApp(),
      deleteApp: async () => {
        calls.push('delete-app')
        return false
      },
      deleteStore: async () => {
        calls.push('delete-store')
        return true
      },
      record: (record) => records.push(record),
    })

    expect(calls).toEqual(['delete-app'])
    expect(records).toContainEqual({
      phase: 'delete-store',
      status: 'skipped',
      detail: 'app deletion was not confirmed',
    })
  })

  test('does not replace the test result when a cleanup phase throws', async () => {
    const calls: string[] = []
    const records: CleanupPhaseRecord[] = []

    await expect(
      runTeardown({
        hasStore: true,
        uninstallApp: async () => {
          calls.push('uninstall-app')
          throw new Error('uninstall failed')
        },
        waitForAppDeletionReadiness: async () => {
          calls.push('wait-for-zero-installs')
          return readyApp()
        },
        deleteApp: async () => {
          calls.push('delete-app')
          throw new Error('delete failed')
        },
        deleteStore: async () => {
          calls.push('delete-store')
          return true
        },
        record: (record) => records.push(record),
      }),
    ).resolves.toBeUndefined()

    expect(calls).toEqual(['uninstall-app', 'wait-for-zero-installs', 'delete-app'])
    expect(records).toContainEqual({phase: 'uninstall-app', status: 'failed', detail: 'uninstall failed'})
    expect(records).toContainEqual({phase: 'delete-app', status: 'failed', detail: 'delete failed'})
    expect(records).toContainEqual({phase: 'delete-store', status: 'skipped', detail: 'app deletion failed'})
  })

  test('does not treat unknown install state as zero installs', async () => {
    const calls: string[] = []
    const records: CleanupPhaseRecord[] = []

    await runTeardown({
      hasStore: true,
      uninstallApp: async () => {},
      waitForAppDeletionReadiness: async () => {
        throw new Error('query failed')
      },
      deleteApp: async () => {
        calls.push('delete-app')
        return true
      },
      deleteStore: async () => {
        calls.push('delete-store')
        return true
      },
      record: (record) => records.push(record),
    })

    expect(calls).toEqual([])
    expect(records).toContainEqual({
      phase: 'wait-for-zero-installs',
      status: 'failed',
      detail: 'query failed',
    })
    expect(records).toContainEqual({phase: 'delete-app', status: 'skipped', detail: 'installation state is unknown'})
    expect(records).toContainEqual({
      phase: 'delete-store',
      status: 'skipped',
      detail: 'installation state is unknown',
    })
  })

  test('does not delete resources while the app still has installs', async () => {
    const calls: string[] = []
    const records: CleanupPhaseRecord[] = []

    await runTeardown({
      hasStore: true,
      uninstallApp: async () => {},
      waitForAppDeletionReadiness: async () => ({status: 'still-installed', installCount: 1}),
      deleteApp: async () => {
        calls.push('delete-app')
        return true
      },
      deleteStore: async () => {
        calls.push('delete-store')
        return true
      },
      record: (record) => records.push(record),
    })

    expect(calls).toEqual([])
    expect(records).toContainEqual({
      phase: 'wait-for-zero-installs',
      status: 'failed',
      detail: 'app still has 1 install(s)',
    })
    expect(records).toContainEqual({phase: 'delete-app', status: 'skipped', detail: 'app still has installs'})
    expect(records).toContainEqual({phase: 'delete-store', status: 'skipped', detail: 'app still has installs'})
  })

  test('deletes the store when the app is already deleted', async () => {
    const calls: string[] = []

    await runTeardown({
      hasStore: true,
      waitForAppDeletionReadiness: async () => ({status: 'already-deleted'}),
      deleteApp: async () => {
        calls.push('delete-app')
        return true
      },
      deleteStore: async () => {
        calls.push('delete-store')
        return true
      },
      record: () => {},
    })

    expect(calls).toEqual(['delete-store'])
  })
})

function readyApp(): AppDeletionReadiness {
  return {status: 'ready', app: {id: 'gid://organization/App/1', key: 'client-id'}}
}
