/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable jsdoc/require-throws */
/* eslint-disable no-restricted-imports */

import {outputDebug} from './output.js'
import {exec, spawn} from 'child_process'

interface ProcessTree {
  [key: string]: string[]
}

type AfterKillCallback = (error?: Error) => void

/**
 * Kills the process that calls the method and all its children.
 *
 * @param pid - Pid of the process to kill.
 * @param killSignal - Type of kill signal to be used.
 * @param killRoot - Whether to kill the root process.
 * @param callback - Optional callback to run after killing the processes.
 */
export function treeKill(
  pid: number | string = process.pid,
  killSignal = 'SIGTERM',
  killRoot = true,
  callback?: AfterKillCallback,
): void {
  const after =
    callback ??
    ((error?: Error) => {
      if (error) outputDebug(`Failed to kill process ${pid}: ${error}`)
    })
  adaptedTreeKill(pid, killSignal, killRoot, after)
}

/**
 * Adapted from https://github.com/pkrumins/node-tree-kill.
 *
 * Our implementation allows to skip killing the root process. This is useful for example when
 * gracefully exiting the 'dev' process, as the default tree-kill implementation will cause it
 * to exit with a non-zero code. Instead, we want to treat it as a graceful termination.
 * In addition, we also add debug logging for better visibility in what tree-kill is doing.
 *
 * @param pid - Pid of the process to kill.
 * @param killSignal - Type of kill signal to be used.
 * @param killRoot - Whether to kill the root process.
 * @param callback - Optional callback to run after killing the processes.
 */
function adaptedTreeKill(
  pid: number | string,
  killSignal: string,
  killRoot: boolean,
  callback: (error?: Error) => void,
): void {
  const rootPid = typeof pid === 'number' ? pid.toString() : pid

  if (Number.isNaN(rootPid)) {
    if (callback) {
      callback(new Error('pid must be a number'))
      return
    } else {
      throw new Error('pid must be a number')
    }
  }

  // A map from parent pid to an array of children pids
  const tree: ProcessTree = {}
  tree[rootPid] = []

  // A set of pids to visit. We use it to recursively find all the children pids
  const pidsToProcess = new Set<string>()
  pidsToProcess.add(rootPid)

  switch (process.platform) {
    case 'win32':
      // @ts-ignore
      exec(`taskkill /pid ${pid} /T /F`, callback)
      break
    case 'darwin':
      buildProcessTree(
        rootPid,
        tree,
        pidsToProcess,
        function (parentPid: string) {
          return spawn('pgrep', ['-lfP', parentPid])
        },
        function () {
          killAll(tree, killSignal, rootPid, killRoot, callback)
        },
      )
      break
    // Linux
    default:
      buildProcessTree(
        rootPid,
        tree,
        pidsToProcess,
        function (parentPid: string) {
          return spawn('ps', ['-o', 'pid command', '--no-headers', '--ppid', parentPid])
        },
        function () {
          killAll(tree, killSignal, rootPid, killRoot, callback)
        },
      )
      break
  }
}

/**
 * Kills all processes in the process tree.
 *
 * @param tree - Process tree.
 * @param killSignal - Type of kill signal to be used.
 * @param rootPid - Pid of the root process.
 * @param killRoot - Whether to kill the root process.
 * @param callback - Optional callback to run after killing the processes.
 */
function killAll(
  tree: ProcessTree,
  killSignal: string,
  rootPid: string,
  killRoot: boolean,
  callback: AfterKillCallback,
): void {
  const killed = new Set<string>()
  try {
    Object.keys(tree).forEach(function (pid) {
      tree[pid]!.forEach(function (pidpid) {
        if (!killed.has(pidpid)) {
          killPid(pidpid, killSignal)
          killed.add(pidpid)
        }
      })
      if (pid === rootPid && killRoot && !killed.has(pid)) {
        killPid(pid, killSignal)
        killed.add(pid)
      }
    })
  } catch (err: unknown) {
    if (callback) {
      // @ts-ignore
      callback(err)
      return
    } else {
      throw err
    }
  }
  if (callback) {
    callback()
  }
}

/**
 * Kills a process.
 *
 * @param pid - Pid of the process to kill.
 * @param killSignal - Type of kill signal to be used.
 */
function killPid(pid: string, killSignal: string) {
  try {
    process.kill(parseInt(pid, 10), killSignal)
  } catch (err) {
    // @ts-ignore
    if (err.code !== 'ESRCH') throw err
  }
}

/**
 * Builds a process tree.
 *
 * @param parentPid - Pid of the parent process.
 * @param tree - Process tree.
 * @param pidsToProcess - Pids to process.
 * @param spawnChildProcessesList - Function to spawn child processes.
 * @param cb - Callback to run after building the process tree.
 */
function buildProcessTree(
  parentPid: string,
  tree: ProcessTree,
  pidsToProcess: Set<string>,
  spawnChildProcessesList: (parentPid: string) => ReturnType<typeof spawn>,
  cb: () => void,
) {
  const ps = spawnChildProcessesList(parentPid)
  let allData = ''
  ps.stdout?.on('data', function (data: Buffer) {
    const dataStr = data.toString('ascii')
    allData += dataStr
  })

  const onClose = (code: number) => {
    pidsToProcess.delete(parentPid)

    if (code !== 0) {
      // no more parent processes
      if (pidsToProcess.size === 0) {
        cb()
        return
      }
      return
    }

    allData
      .trim()
      .split('\n')
      .forEach(function (line) {
        const match = line.match(/^(\d+)\s(.*)$/)
        if (match) {
          const pid = match[1]!
          const cmd = match[2]!
          tree[parentPid]!.push(pid)
          tree[pid] = []
          outputDebug(`Killing process ${pid}: ${cmd}`)
          pidsToProcess.add(pid)
          buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb)
        }
      })
  }

  ps.on('close', onClose)
}
