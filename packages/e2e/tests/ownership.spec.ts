/* eslint-disable no-await-in-loop, no-restricted-imports */
import {assertPortsAvailable, workerPorts} from '../setup/ports.js'
import {terminateProcessTree} from '../setup/process.js'
import {expect, test} from '@playwright/test'
import {execa} from 'execa'
import {createServer} from 'node:net'
import * as fs from 'node:fs'
import * as path from 'node:path'

test.describe('E2E resource ownership', () => {
  // eslint-disable-next-line no-empty-pattern
  test('terminates a spawned process and its child', async ({}, testInfo) => {
    fs.mkdirSync(testInfo.outputDir, {recursive: true})
    const tempDir = fs.mkdtempSync(path.join(testInfo.outputDir, 'process-'))
    const childPidPath = path.join(tempDir, 'child.pid')
    const rootProcess = execa(
      'node',
      [
        '-e',
        `
          const {spawn} = require('node:child_process')
          const {writeFileSync} = require('node:fs')
          const child = spawn(
            process.execPath,
            ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000)"],
            {stdio: 'ignore'},
          )
          writeFileSync(process.argv[1], String(child.pid))
          process.on('SIGTERM', () => {})
          setInterval(() => {}, 1_000)
        `,
        childPidPath,
      ],
      {detached: process.platform !== 'win32', reject: false},
    )
    if (!rootProcess.pid) throw new Error('Test process did not expose its PID')

    const childPid = Number(await waitForFile(childPidPath))

    try {
      await terminateProcessTree(
        {
          pid: rootProcess.pid,
          command: 'ownership test process',
          owner: 'test',
          waitForExit: async (timeoutMs) => {
            const result = await withTimeout(rootProcess, timeoutMs)
            return result.exitCode ?? 1
          },
        },
        2_000,
      )

      await expect(waitForProcessExit(childPid)).resolves.toBeUndefined()
    } finally {
      terminateExactProcess(childPid)
      terminateExactProcess(rootProcess.pid)
      fs.rmSync(tempDir, {recursive: true, force: true})
    }
  })

  test('reports the owner and configured variable for an occupied port', async () => {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not expose its port')

    try {
      await expect(
        assertPortsAvailable(
          [{environmentVariable: 'SHOPIFY_FLAG_GRAPHIQL_PORT', port: address.port}],
          'worker=3 phase=claim',
        ),
      ).rejects.toThrow(
        `[e2e][ports] owner=worker=3 phase=claim unavailable=SHOPIFY_FLAG_GRAPHIQL_PORT=${address.port}`,
      )
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    }
  })

  test('reports process ownership when termination fails', async () => {
    const missingPid = 99_999_999

    await expect(
      terminateProcessTree({
        pid: missingPid,
        command: 'shopify app dev',
        owner: 'worker=4',
        waitForExit: () => Promise.reject(new Error('process did not exit')),
      }),
    ).rejects.toThrow(`[e2e][process] owner=worker=4 failed to terminate pid=${missingPid} command="shopify app dev"`)
  })

  test('assigns distinct fixed ports to each worker', () => {
    expect(workerPorts(0)).toEqual([
      {environmentVariable: 'SHOPIFY_FLAG_GRAPHIQL_PORT', port: 3457},
      {environmentVariable: 'SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT', port: 3459},
    ])
    expect(workerPorts(1)).toEqual([
      {environmentVariable: 'SHOPIFY_FLAG_GRAPHIQL_PORT', port: 3467},
      {environmentVariable: 'SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT', port: 3469},
    ])
  })
})

async function waitForFile(filePath: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${filePath}`)
}

async function waitForProcessExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!isProcessRunning(pid)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Process ${pid} is still running`)
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

function terminateExactProcess(pid: number): void {
  if (!isProcessRunning(pid)) return
  try {
    process.kill(pid, 'SIGKILL')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // The process exited after the ownership check.
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
