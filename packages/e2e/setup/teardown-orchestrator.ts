export type AppDeletionReadiness =
  | {status: 'ready'; app: {id: string; key: string}}
  | {status: 'already-deleted'}
  | {status: 'still-installed'; installCount: number}

export type CleanupPhase = 'uninstall-app' | 'wait-for-zero-installs' | 'delete-app' | 'delete-store'
export type CleanupPhaseStatus = 'completed' | 'failed' | 'skipped'

export interface CleanupPhaseRecord {
  phase: CleanupPhase
  status: CleanupPhaseStatus
  detail: string
}

interface TeardownOperations {
  hasStore: boolean
  uninstallApp?: () => Promise<void>
  waitForAppDeletionReadiness: () => Promise<AppDeletionReadiness>
  deleteApp: (app: {id: string; key: string}) => Promise<boolean>
  deleteStore?: () => Promise<boolean>
  record: (record: CleanupPhaseRecord) => void
}

export async function runTeardown(operations: TeardownOperations): Promise<void> {
  if (operations.hasStore) {
    if (operations.uninstallApp) {
      try {
        await operations.uninstallApp()
        operations.record({phase: 'uninstall-app', status: 'completed', detail: 'app uninstalled'})
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        operations.record({phase: 'uninstall-app', status: 'failed', detail: errorMessage(error)})
      }
    } else {
      operations.record({
        phase: 'uninstall-app',
        status: 'skipped',
        detail: 'app directory unavailable',
      })
    }
  }

  let readiness: AppDeletionReadiness
  try {
    readiness = await operations.waitForAppDeletionReadiness()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    operations.record({phase: 'wait-for-zero-installs', status: 'failed', detail: errorMessage(error)})
    skipRemainingPhases(operations, 'installation state is unknown')
    return
  }

  if (readiness.status === 'still-installed') {
    operations.record({
      phase: 'wait-for-zero-installs',
      status: 'failed',
      detail: `app still has ${readiness.installCount} install(s)`,
    })
    skipRemainingPhases(operations, 'app still has installs')
    return
  }

  operations.record({
    phase: 'wait-for-zero-installs',
    status: 'completed',
    detail: readiness.status === 'already-deleted' ? 'app already deleted' : 'app has zero installs',
  })

  if (readiness.status === 'already-deleted') {
    operations.record({phase: 'delete-app', status: 'completed', detail: 'app already deleted'})
  } else {
    try {
      const deleted = await operations.deleteApp(readiness.app)
      operations.record({
        phase: 'delete-app',
        status: deleted ? 'completed' : 'failed',
        detail: deleted ? 'app deleted' : 'app deletion was not confirmed',
      })
      if (!deleted) {
        skipStoreDeletion(operations, 'app deletion was not confirmed')
        return
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      operations.record({phase: 'delete-app', status: 'failed', detail: errorMessage(error)})
      skipStoreDeletion(operations, 'app deletion failed')
      return
    }
  }

  if (!operations.hasStore) return

  if (!operations.deleteStore) {
    operations.record({phase: 'delete-store', status: 'failed', detail: 'store deletion operation unavailable'})
    return
  }

  try {
    const deleted = await operations.deleteStore()
    operations.record({
      phase: 'delete-store',
      status: deleted ? 'completed' : 'failed',
      detail: deleted ? 'store deletion requested' : 'store deletion was not confirmed',
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    operations.record({phase: 'delete-store', status: 'failed', detail: errorMessage(error)})
  }
}

function skipRemainingPhases(operations: TeardownOperations, detail: string): void {
  operations.record({phase: 'delete-app', status: 'skipped', detail})
  skipStoreDeletion(operations, detail)
}

function skipStoreDeletion(operations: TeardownOperations, detail: string): void {
  if (operations.hasStore) {
    operations.record({phase: 'delete-store', status: 'skipped', detail})
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
