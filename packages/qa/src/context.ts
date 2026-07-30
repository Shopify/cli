import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {fileURLToPath} from 'url'
import type {PtyProcess} from './proc.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface CtxState {
  /** Directory of the app created by `app init`. */
  appDir?: string
  /** Name given to the app created by `app init`. */
  appName?: string
  /** GraphiQL server coordinates passed to `app dev`. */
  graphiql?: {port: number; key: string}
  /** The long-running `app dev` pty process. */
  devProc?: PtyProcess
  /** Directory of the hydrogen app. */
  hydrogenDir?: string
  /** Name of the secondary config created by `app config link` (e.g. "staging"). */
  secondaryConfig?: string
  /** Any pty processes to kill during teardown. */
  ptyProcs: PtyProcess[]
}

export interface Ctx {
  /** argv prefix used to invoke the CLI under test, e.g. ['node', '/path/to/run.js'] or ['shopify']. */
  cliInvoke: string[]
  /** Human description of what is being tested (repo build vs installed package). */
  cliTarget: string
  /** Root scratch directory for this run. */
  workDir: string
  /** Environment passed to every CLI invocation. */
  env: {[key: string]: string}
  orgId?: string
  storeFqdn?: string
  /** When set, the version step asserts `shopify version` equals this. */
  expectedVersion?: string
  state: CtxState
  log: (msg: string) => void
}

function repoRoot(): string {
  // packages/qa/src -> repo root
  return path.resolve(__dirname, '..', '..', '..')
}

/**
 * Build the run context from environment variables.
 *
 * QA_CLI_BIN            Path to the CLI entrypoint (JS file or executable).
 *                       Defaults to the repo build at packages/cli/bin/run.js.
 * QA_EXPECTED_VERSION   Assert `shopify version` equals this value.
 * QA_ORG_ID             Organization id used for `app init` (falls back to E2E_ORG_ID).
 * QA_STORE_FQDN         Dev store passed to `app dev` (falls back to E2E_STORE_FQDN).
 * QA_WORK_DIR           Scratch dir (defaults to a fresh mkdtemp).
 * QA_ISOLATE            When "1", run with fresh XDG dirs so the ambient CLI session
 *                       is not used. CI sets this; local runs default to ambient auth.
 */
export function createContext(log: (msg: string) => void = defaultLog): Ctx {
  const binEnv = process.env.QA_CLI_BIN
  const defaultBin = path.join(repoRoot(), 'packages', 'cli', 'bin', 'run.js')
  const bin = binEnv ?? defaultBin

  let cliInvoke: string[]
  if (bin.endsWith('.js') || bin.endsWith('.mjs') || bin.endsWith('.cjs')) {
    cliInvoke = [process.execPath, bin]
  } else {
    cliInvoke = [bin]
  }
  const cliTarget = binEnv ? `installed CLI at ${bin}` : 'repo build (packages/cli/bin/run.js)'

  const workDir =
    process.env.QA_WORK_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'shopify-qa-'))
  fs.mkdirSync(workDir, {recursive: true})

  const env: {[key: string]: string} = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  // Deterministic, machine-readable CLI output.
  env.FORCE_COLOR = '0'
  env.SHOPIFY_CLI_NO_ANALYTICS = '1'
  env.SHOPIFY_FLAG_VERBOSE = ''
  delete env.NODE_OPTIONS
  // pnpm sets INIT_CWD to where `pnpm qa` was invoked; cli-kit's cwd() prefers
  // it over the real process cwd, which would break every --path resolution.
  // proc.ts re-points INIT_CWD/PWD at the effective cwd per invocation.
  delete env.INIT_CWD
  delete env.PWD

  if (process.env.QA_ISOLATE === '1') {
    const authDir = path.join(workDir, 'xdg')
    for (const name of ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']) {
      const dir = path.join(authDir, name)
      fs.mkdirSync(dir, {recursive: true})
      env[name] = dir
    }
  }

  return {
    cliInvoke,
    cliTarget,
    workDir,
    env,
    orgId: process.env.QA_ORG_ID ?? process.env.E2E_ORG_ID,
    storeFqdn: process.env.QA_STORE_FQDN ?? process.env.E2E_STORE_FQDN,
    expectedVersion: process.env.QA_EXPECTED_VERSION,
    state: {ptyProcs: []},
    log,
  }
}

function defaultLog(msg: string): void {
  process.stdout.write(`[qa] ${msg}\n`)
}
