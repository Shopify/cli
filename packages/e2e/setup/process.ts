import type {IPty} from 'node-pty'

interface ProcessTreeOwner {
  pid: number
  command: string
  owner: string
  waitForExit: (timeoutMs: number) => Promise<number>
}

export interface ProcessExitObserver {
  hasExited: () => boolean
  waitForExit: (timeoutMs: number) => Promise<number>
}

export function observePtyExit(ptyProcess: Pick<IPty, 'onExit'>): ProcessExitObserver {
  let exitCode: number | undefined
  const waiters = new Set<(exitCode: number) => void>()

  ptyProcess.onExit(({exitCode: code}) => {
    exitCode = code
    for (const resolve of waiters) resolve(code)
    waiters.clear()
  })

  return {
    hasExited: () => exitCode !== undefined,
    waitForExit: (timeoutMs) => {
      if (exitCode !== undefined) return Promise.resolve(exitCode)

      return new Promise((resolve, reject) => {
        const handleExit = (code: number) => {
          clearTimeout(timer)
          waiters.delete(handleExit)
          resolve(code)
        }
        const timer = setTimeout(() => {
          waiters.delete(handleExit)
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for process exit`))
        }, timeoutMs)
        waiters.add(handleExit)
      })
    },
  }
}

export async function terminateProcessTree(owner: ProcessTreeOwner, timeoutMs = 5_000): Promise<void> {
  const signalFailures: string[] = []
  const exitFailures: string[] = []

  await killTree(owner.pid).catch((error) => signalFailures.push(errorMessage(error)))
  killProcessGroup(owner.pid, signalFailures)
  await Promise.all([
    owner.waitForExit(timeoutMs).catch((error) => exitFailures.push(errorMessage(error))),
    waitForProcessGroupExit(owner.pid, timeoutMs).catch((error) => exitFailures.push(errorMessage(error))),
  ])

  if (exitFailures.length > 0) {
    throw new Error(
      `[e2e][process] owner=${owner.owner} failed to terminate pid=${owner.pid} command=${JSON.stringify(
        owner.command,
      )} failures=${JSON.stringify([...signalFailures, ...exitFailures])}`,
    )
  }
}

async function killTree(pid: number): Promise<void> {
  // A static import makes Playwright load CLI Kit's UI graph during test discovery.
  const {treeKill} = await import('@shopify/cli-kit/node/tree-kill')

  return new Promise((resolve, reject) => {
    treeKill(pid, 'SIGKILL', true, (error) => (error ? reject(error) : resolve()))
  })
}

function killProcessGroup(pid: number, failures: string[]): void {
  if (process.platform === 'win32') return

  try {
    process.kill(-pid, 'SIGKILL')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    if (!isMissingProcessError(error)) failures.push(errorMessage(error))
  }
}

function waitForProcessGroupExit(pid: number, timeoutMs: number): Promise<void> {
  if (process.platform === 'win32' || !isProcessGroupRunning(pid)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (!isProcessGroupRunning(pid)) {
        clearInterval(interval)
        clearTimeout(timeout)
        resolve()
      }
    }, 50)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for process group ${pid} to exit`))
    }, timeoutMs)
  })
}

function isProcessGroupRunning(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return !isMissingProcessError(error)
  }
}

function isMissingProcessError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
