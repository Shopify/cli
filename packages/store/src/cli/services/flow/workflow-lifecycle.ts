import {dispatchFlowTool} from './dispatch.js'
import {formatZodErrors} from './zod-errors.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, glob, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
import {createHash} from 'crypto'

const TOOL_CREATE_OR_UPDATE = 'flow_app_agent_create_or_update_workflow_from_json'
const TOOL_WORKFLOW_LOOKUP = 'flow_app_agent_workflow_lookup'
const TOOL_LIST_WORKFLOWS = 'flow_app_agent_list_workflows'
const TOOL_ACTIVATE = 'flow_app_agent_activate_workflow'
const TOOL_DEACTIVATE = 'flow_app_agent_deactivate_workflow'

const LockfileSchema = zod
  .object({
    workflow_id: zod.string().min(1),
    workflow_definition_version: zod.string().min(1),
    payload_sha256: zod.string().regex(/^[a-f0-9]{64}$/, 'must be a 64-char lowercase hex sha256'),
    store: zod.string().min(1),
    pushed_at: zod.string().datetime(),
  })
  .strict()

export type Lockfile = zod.infer<typeof LockfileSchema>

export interface UpsertResponse {
  ok: boolean
  tool?: string
  data?: UpsertResponseJson
}

export interface UpsertResponseJson {
  message?: string
  workflow_id?: string
  workflow_version?: string
  workflow_definition_version?: string
  validation_errors?: unknown[]
  workflow_definition?: WorkflowJson
  error?: string
  error_code?: string
}

export interface LookupResponseJson {
  workflow_id?: string
  workflow_version?: string
  workflow_definition?: WorkflowJson
  error?: string
  error_code?: string
}

export type WorkflowJson = Record<string, unknown>

export function normalizeWorkflowJson(payload: WorkflowJson): string {
  return `${JSON.stringify(sortKeys(payload), null, 2)}\n`
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, val]) => [key, sortKeys(val)] as const)
    return Object.fromEntries(entries)
  }
  return value
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function lockfilePath(workflowFilePath: string): string {
  return workflowFilePath.replace(/\.flow\.json$/, '.flow.lock.json')
}

export async function readWorkflowFile(filePath: string): Promise<WorkflowJson> {
  if (!(await fileExists(filePath))) {
    throw new AbortError(`Workflow file not found at ${filePath}.`)
  }
  const raw = await readFile(filePath, {encoding: 'utf8'})
  try {
    return JSON.parse(raw) as WorkflowJson
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(`Workflow file ${filePath} is not valid JSON: ${message}`)
  }
}

export async function readLockfileIfExists(workflowFilePath: string): Promise<Lockfile | undefined> {
  const path = lockfilePath(workflowFilePath)
  if (!(await fileExists(path))) return undefined

  const raw = await readFile(path, {encoding: 'utf8'})

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new AbortError(
      `Lockfile at ${path} is not valid JSON: ${message}`,
      'Repair the file by hand, restore from git, or delete and re-run `pull`/`push` to regenerate.',
    )
  }

  const result = LockfileSchema.safeParse(parsed)
  if (!result.success) {
    // Throw on corrupt rather than silently treating as missing — silently
    // treating a bad lockfile as "no lockfile" makes `push` create a brand-
    // new workflow on the shop, duplicating whatever this lockfile pointed at.
    throw new AbortError(
      `Lockfile at ${path} has unexpected shape.`,
      `${formatZodErrors(result.error)}\n\nRepair the file, restore from git, or delete and re-pull to regenerate.`,
    )
  }
  return result.data
}

export async function writeLockfile(workflowFilePath: string, lockfile: Lockfile): Promise<void> {
  const path = lockfilePath(workflowFilePath)
  await writeFile(path, `${JSON.stringify(lockfile, null, 2)}\n`)
}

export async function writeWorkflowFile(filePath: string, payload: WorkflowJson): Promise<void> {
  await writeFile(filePath, normalizeWorkflowJson(payload))
}

function unwrapJsonResult(response: unknown): UpsertResponseJson {
  const typed = response as {ok: boolean; data?: UpsertResponseJson} | undefined
  if (!typed?.data) throw new AbortError('Flow tool returned an unexpected response shape.')
  return typed.data
}

function unwrapLookupResult(response: unknown): LookupResponseJson {
  const typed = response as {ok: boolean; data?: LookupResponseJson} | undefined
  if (!typed?.data) throw new AbortError('Flow workflow lookup returned an unexpected response shape.')
  return typed.data
}

export interface ValidateInput {
  filePath: string
  store: string
}

export async function validateWorkflow(input: ValidateInput): Promise<UpsertResponseJson> {
  const payload = await readWorkflowFile(input.filePath)
  const lockfile = await readLockfileIfExists(input.filePath)

  const args: Record<string, unknown> = {workflow_json: payload}
  if (lockfile) {
    args.workflow_id = lockfile.workflow_id
    args.workflow_version = lockfile.workflow_definition_version
  }

  const response = await dispatchFlowTool({
    name: TOOL_CREATE_OR_UPDATE, source: 'flow',
    store: input.store,
    args,
    isEval: true,
  })

  return unwrapJsonResult(response)
}

export interface PushInput {
  filePath: string
  store: string
}

export interface PushResult {
  workflowId: string
  workflowDefinitionVersion: string
  validationErrors: unknown[]
  lockfile: Lockfile
}

export async function pushWorkflow(input: PushInput): Promise<PushResult> {
  const payload = await readWorkflowFile(input.filePath)
  const lockfile = await readLockfileIfExists(input.filePath)

  const args: Record<string, unknown> = {
    workflow_json: payload,
    hidden: false,
  }
  if (lockfile) {
    args.workflow_id = lockfile.workflow_id
    args.workflow_version = lockfile.workflow_definition_version
  }

  const response = await dispatchFlowTool({
    name: TOOL_CREATE_OR_UPDATE, source: 'flow',
    store: input.store,
    args,
  })

  const json = unwrapJsonResult(response)
  if (!json.workflow_id || !json.workflow_version) {
    throw new AbortError(`Push failed: ${json.error ?? 'no workflow_id returned'}`)
  }

  const canonicalPayload = json.workflow_definition ?? payload
  const canonicalNormalized = normalizeWorkflowJson(canonicalPayload)
  if (json.workflow_definition) {
    await writeWorkflowFile(input.filePath, canonicalPayload)
  }

  const newLockfile: Lockfile = {
    workflow_id: json.workflow_id,
    workflow_definition_version: json.workflow_version,
    payload_sha256: sha256(canonicalNormalized),
    store: input.store,
    pushed_at: new Date().toISOString(),
  }
  await writeLockfile(input.filePath, newLockfile)

  return {
    workflowId: json.workflow_id,
    workflowDefinitionVersion: json.workflow_version,
    validationErrors: json.validation_errors ?? [],
    lockfile: newLockfile,
  }
}

export interface PullInput {
  workflowId: string
  workflowVersion?: string
  outPath: string
  store: string
}

export interface PullResult {
  workflowId: string
  workflowDefinitionVersion: string
  payload: WorkflowJson
  lockfile: Lockfile
}

export async function pullWorkflow(input: PullInput): Promise<PullResult> {
  const args: Record<string, unknown> = {workflow_id: input.workflowId}
  if (input.workflowVersion) args.version = input.workflowVersion

  const response = await dispatchFlowTool({
    name: TOOL_WORKFLOW_LOOKUP, source: 'flow',
    store: input.store,
    args,
  })

  const json = unwrapLookupResult(response)
  if (!json.workflow_definition || !json.workflow_id || !json.workflow_version) {
    throw new AbortError(`Pull failed: ${json.error ?? 'workflow_definition missing from response'}`)
  }

  await writeWorkflowFile(input.outPath, json.workflow_definition)

  const lockfile: Lockfile = {
    workflow_id: json.workflow_id,
    workflow_definition_version: json.workflow_version,
    payload_sha256: sha256(normalizeWorkflowJson(json.workflow_definition)),
    store: input.store,
    pushed_at: new Date().toISOString(),
  }
  await writeLockfile(input.outPath, lockfile)

  return {
    workflowId: json.workflow_id,
    workflowDefinitionVersion: json.workflow_version,
    payload: json.workflow_definition,
    lockfile,
  }
}

export interface DiffInput {
  filePath: string
  store: string
  workflowId?: string
  workflowVersion?: string
}

export interface DiffResult {
  changed: boolean
  localNormalized: string
  remoteNormalized: string
}

export async function fetchRemoteWorkflow(input: {
  workflowId: string
  workflowVersion?: string
  store: string
}): Promise<WorkflowJson> {
  const args: Record<string, unknown> = {workflow_id: input.workflowId}
  if (input.workflowVersion) args.version = input.workflowVersion

  const response = await dispatchFlowTool({
    name: TOOL_WORKFLOW_LOOKUP, source: 'flow',
    store: input.store,
    args,
  })

  const json = unwrapLookupResult(response)
  if (!json.workflow_definition) {
    throw new AbortError(`Remote workflow lookup failed: ${json.error ?? 'no workflow_definition'}`)
  }
  return json.workflow_definition
}

export async function diffWorkflow(input: DiffInput): Promise<DiffResult> {
  const localPayload = await readWorkflowFile(input.filePath)
  const localNormalized = normalizeWorkflowJson(localPayload)

  const workflowId = input.workflowId ?? (await readLockfileIfExists(input.filePath))?.workflow_id
  if (!workflowId) {
    throw new AbortError(
      `No lockfile found for ${input.filePath} and no --workflow-id was provided.`,
      'Run `shopify flow workflow push` first, or pass --workflow-id.',
    )
  }

  const remotePayload = await fetchRemoteWorkflow({
    workflowId,
    workflowVersion: input.workflowVersion,
    store: input.store,
  })
  const remoteNormalized = normalizeWorkflowJson(remotePayload)

  return {
    changed: localNormalized !== remoteNormalized,
    localNormalized,
    remoteNormalized,
  }
}

export function unifiedDiff(remoteLabel: string, remoteText: string, localLabel: string, localText: string): string {
  const remoteLines = remoteText.split('\n')
  const localLines = localText.split('\n')
  const lines: string[] = [`--- ${remoteLabel}`, `+++ ${localLabel}`]

  const lcs = longestCommonSubsequence(remoteLines, localLines)
  let i = 0
  let j = 0
  let k = 0
  while (i < remoteLines.length || j < localLines.length) {
    if (k < lcs.length && remoteLines[i] === lcs[k] && localLines[j] === lcs[k]) {
      lines.push(` ${remoteLines[i]}`)
      i++
      j++
      k++
    } else if (j < localLines.length && (k >= lcs.length || localLines[j] !== lcs[k])) {
      lines.push(`+${localLines[j]}`)
      j++
    } else if (i < remoteLines.length && (k >= lcs.length || remoteLines[i] !== lcs[k])) {
      lines.push(`-${remoteLines[i]}`)
      i++
    }
  }
  return lines.join('\n')
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const dp: number[][] = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }
  const result: string[] = []
  let i = a.length
  let j = b.length
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]!)
      i--
      j--
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--
    } else {
      j--
    }
  }
  return result
}

export interface ActivationInput {
  filePath?: string
  store: string
  workflowId?: string
  workflowVersion?: string
  useLatest?: boolean
}

async function resolveActivationTarget(input: ActivationInput): Promise<{workflowId: string; workflowVersion: string}> {
  if (input.workflowId && input.workflowVersion) {
    return {workflowId: input.workflowId, workflowVersion: input.workflowVersion}
  }

  if (input.workflowId && input.useLatest) {
    const remote = await fetchRemoteWorkflow({
      workflowId: input.workflowId,
      store: input.store,
    })
    const version = (remote as {root?: {workflow_version?: string}})?.root?.workflow_version
    if (!version) {
      throw new AbortError('Could not resolve latest workflow version from workflow lookup response.')
    }
    return {workflowId: input.workflowId, workflowVersion: version}
  }

  if (input.filePath) {
    const lockfile = await readLockfileIfExists(input.filePath)
    if (lockfile) {
      return {
        workflowId: lockfile.workflow_id,
        workflowVersion: lockfile.workflow_definition_version,
      }
    }
  }

  throw new AbortError(
    'Cannot resolve workflow target.',
    'Pass a workflow file with a lockfile, or --workflow-id together with --workflow-version or --use-latest.',
  )
}

export async function activateWorkflow(input: ActivationInput): Promise<UpsertResponseJson> {
  const {workflowId, workflowVersion} = await resolveActivationTarget(input)
  const response = await dispatchFlowTool({
    name: TOOL_ACTIVATE, source: 'flow',
    store: input.store,
    args: {workflow_id: workflowId, workflow_definition_version: workflowVersion},
  })
  return unwrapJsonResult(response)
}

export async function deactivateWorkflow(input: ActivationInput): Promise<UpsertResponseJson> {
  const {workflowId, workflowVersion} = await resolveActivationTarget(input)
  const response = await dispatchFlowTool({
    name: TOOL_DEACTIVATE, source: 'flow',
    store: input.store,
    args: {workflow_id: workflowId, workflow_definition_version: workflowVersion},
  })
  return unwrapJsonResult(response)
}

export interface RemoteWorkflowSummary {
  workflow_id: string
  name: string
  hidden: boolean
  last_updated?: string
}

interface ListWorkflowsResponseJson {
  workflows?: RemoteWorkflowSummary[]
  pagination?: {
    has_next_page?: boolean
    next_cursor?: string
    total_count?: number
  }
  error?: string
  error_code?: string
}

export async function listAllWorkflows(input: {
  store: string
  includeHidden?: boolean
}): Promise<RemoteWorkflowSummary[]> {
  const all: RemoteWorkflowSummary[] = []
  let cursor: string | undefined

  while (true) {
    const args: Record<string, unknown> = {page_size: 100}
    if (cursor) args.cursor = cursor
    if (input.includeHidden) args.include_hidden = true

    const response = await dispatchFlowTool({
      name: TOOL_LIST_WORKFLOWS, source: 'flow',
      store: input.store,
      args,
    })

    const json = (response as {ok: boolean; data?: ListWorkflowsResponseJson} | undefined)?.data
    if (!json) throw new AbortError('Flow list_workflows returned an unexpected response shape.')
    if (json.error) throw new AbortError(`list_workflows failed: ${json.error}`)

    if (json.workflows) all.push(...json.workflows)

    if (!json.pagination?.has_next_page || !json.pagination.next_cursor) break
    cursor = json.pagination.next_cursor
  }

  return all
}

export const WORKFLOW_FILENAME = 'workflow.flow.json'

export function workflowSlugFor(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'workflow'
}

export function workflowDirAndFilename(name: string): {dir: string; filename: string} {
  return {dir: workflowSlugFor(name), filename: WORKFLOW_FILENAME}
}

export interface PullAllInput {
  store: string
  outDir: string
  includeHidden?: boolean
  force?: boolean
}

export interface PullAllItem {
  workflowId: string
  name: string
  filePath: string
  status: 'pulled' | 'skipped'
  reason?: string
}

export interface PullAllResult {
  total: number
  pulled: number
  skipped: number
  items: PullAllItem[]
}

export async function pullAllWorkflows(input: PullAllInput): Promise<PullAllResult> {
  const remote = await listAllWorkflows({store: input.store, includeHidden: input.includeHidden})
  await mkdir(input.outDir)

  const usedSlugs = new Set<string>()
  const items: PullAllItem[] = []

  for (const workflow of remote) {
    const baseSlug = workflowSlugFor(workflow.name)
    let slug = baseSlug
    let suffix = 2
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`
      suffix += 1
    }
    usedSlugs.add(slug)

    const workflowDir = joinPath(input.outDir, slug)
    const filePath = joinPath(workflowDir, WORKFLOW_FILENAME)

    if ((await fileExists(filePath)) && !input.force) {
      items.push({
        workflowId: workflow.workflow_id,
        name: workflow.name,
        filePath,
        status: 'skipped',
        reason: 'file exists (pass --force to overwrite)',
      })
      continue
    }

    await mkdir(workflowDir)
    await pullWorkflow({
      workflowId: workflow.workflow_id,
      outPath: filePath,
      store: input.store,
    })

    items.push({
      workflowId: workflow.workflow_id,
      name: workflow.name,
      filePath,
      status: 'pulled',
    })
  }

  return {
    total: items.length,
    pulled: items.filter((item) => item.status === 'pulled').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    items,
  }
}

export type WorkflowStatus = 'clean' | 'drifted' | 'new' | 'orphaned' | 'unknown'

export interface StatusItem {
  status: WorkflowStatus
  filePath?: string
  workflowId?: string
  name?: string
  message?: string
}

export interface StatusInput {
  store: string
  workflowsDir: string
  includeHidden?: boolean
}

export interface StatusResult {
  store: string
  items: StatusItem[]
  counts: Record<WorkflowStatus, number>
}

async function classifyLocalFile(filePath: string, store: string): Promise<StatusItem> {
  const lockfile = await readLockfileIfExists(filePath)
  if (!lockfile) {
    return {status: 'new', filePath}
  }

  try {
    const localPayload = await readWorkflowFile(filePath)
    const localNormalized = normalizeWorkflowJson(localPayload)
    const remotePayload = await fetchRemoteWorkflow({
      workflowId: lockfile.workflow_id,
      store,
    })
    const remoteNormalized = normalizeWorkflowJson(remotePayload)

    return {
      status: localNormalized === remoteNormalized ? 'clean' : 'drifted',
      filePath,
      workflowId: lockfile.workflow_id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'orphaned',
      filePath,
      workflowId: lockfile.workflow_id,
      message,
    }
  }
}

export async function statusProject(input: StatusInput): Promise<StatusResult> {
  const localFiles = await glob('**/*.flow.json', {
    cwd: input.workflowsDir,
    absolute: true,
  })

  const localItems = await Promise.all(localFiles.map((filePath) => classifyLocalFile(filePath, input.store)))

  const trackedIds = new Set(localItems.map((item) => item.workflowId).filter((id): id is string => Boolean(id)))

  const remote = await listAllWorkflows({store: input.store, includeHidden: input.includeHidden})
  const unknownItems: StatusItem[] = remote
    .filter((workflow) => !trackedIds.has(workflow.workflow_id))
    .map((workflow) => ({
      status: 'unknown' as WorkflowStatus,
      workflowId: workflow.workflow_id,
      name: workflow.name,
    }))

  const items = [...localItems, ...unknownItems]
  const counts: Record<WorkflowStatus, number> = {
    clean: 0,
    drifted: 0,
    new: 0,
    orphaned: 0,
    unknown: 0,
  }
  for (const item of items) counts[item.status] += 1

  return {store: input.store, items, counts}
}
