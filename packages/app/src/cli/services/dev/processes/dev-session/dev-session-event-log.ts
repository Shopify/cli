import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {mkdir, writeFile, appendFile} from '@shopify/cli-kit/node/fs'
import {addToGitIgnore} from '@shopify/cli-kit/node/git'

export interface DevSessionEvent {
  ts: string
  event: string
  [key: string]: unknown
}

/**
 * Append-only JSONL event log for dev sessions.
 * Enables external agents to observe dev session lifecycle by tailing
 * `.shopify/dev-session-events.jsonl` in the app directory.
 *
 * Event types emitted:
 * - `session-starting` — Dev session initialization (`store`, `app_id`, `extension_count`)
 * - `session-created` — Session successfully created (`preview_url`, `graphiql_url`)
 * - `session-updated` — Extensions updated (`extensions_updated`)
 * - `session-start-failed` — Initial build errors prevented session creation (`reason`, `error_count`)
 * - `change-detected` — File change detected (`extension_count`, `extensions[]` with `handle` and `type`)
 * - `bundle-uploaded` — Extensions bundled and uploaded (`duration_ms`, `extensions`, `inherited_count`)
 * - `status-loading`, `status-success`, `status-error` — Status transitions (`message`, `is_ready`, `preview_url`)
 * - `remote-error`, `unknown-error` — Error events (`errors[]`)
 *
 * All events include a `ts` field with an ISO 8601 timestamp.
 * The file is truncated on each `shopify app dev` start.
 */
export class DevSessionEventLog {
  private readonly filePath: string
  private readonly appDirectory: string
  private initialized = false

  constructor(appDirectory: string) {
    this.appDirectory = appDirectory
    this.filePath = joinPath(appDirectory, '.shopify', 'dev-session-events.jsonl')
  }

  async init(): Promise<void> {
    await addToGitIgnore(this.appDirectory, '.shopify')
    await mkdir(dirname(this.filePath))
    await writeFile(this.filePath, '')
    this.initialized = true
  }

  async write(event: Omit<DevSessionEvent, 'ts'>): Promise<void> {
    if (!this.initialized) return
    const line = JSON.stringify({ts: new Date().toISOString(), ...event})
    await appendFile(this.filePath, `${line}\n`)
  }

  close(): void {
    this.initialized = false
  }

  get path(): string {
    return this.filePath
  }
}
