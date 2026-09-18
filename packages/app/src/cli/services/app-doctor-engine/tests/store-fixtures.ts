/**
 * Store test factories. Every export builds fresh objects against a real
 * temporary directory so tests share no state.
 */
import {linkedConfiguration, makeFixtureDirectory, writeFixtureFile} from './context-test-helpers.js'
import {agentResultInput, staticResultInput} from './fixtures/result-contract.js'
import {loadChecks, type Check} from '../checks/index.js'
import {createAppDoctorContext} from '../context/context.js'
import {createAppDoctorResult} from '../results/index.js'
import {buildAppDoctorReviewScopes} from '../scopes/review.js'
import {resultLeaf} from '../store/codec.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorResult, AppDoctorResultInput} from '../results/index.js'
import type {AppDoctorResultKey, AppDoctorWriterMode} from '../store/types.js'
import type {Suppression} from '../types.js'

/**
 * A repository anchored at `root/<name>` holding one app at `<name>-app` with
 * a linked default configuration. Identities are anchor-relative, so distinct
 * names yield distinct configuration identities.
 */
export async function createStoreContext(root: string, name = 'repo'): Promise<AppDoctorContext> {
  const repository = await makeFixtureDirectory(root, name)
  await makeFixtureDirectory(repository, '.git')
  const appDirectory = `${name}-app`
  const configurationPath = await writeFixtureFile(
    repository,
    `${appDirectory}/shopify.app.toml`,
    linkedConfiguration('app-id'),
  )
  await makeFixtureDirectory(repository, `${appDirectory}/web`)
  return createAppDoctorContext({
    configuration: {path: configurationPath, fileName: 'shopify.app.toml', state: 'parsed', clientId: 'app-id'},
    source: 'default',
  })
}

/** The review scope for the app root (or a subdirectory) as Task 3 derives it. */
export async function reviewScope(context: AppDoctorContext, directory = '.') {
  const scopes = await buildAppDoctorReviewScopes(context, {
    reviewDirectories: [directory],
    invocationDirectory: context.appRoot,
  })
  const scope = scopes[0]
  if (!scope) throw new Error('expected one review scope')
  return scope
}

export interface StoredResultOptions {
  readonly mode?: AppDoctorWriterMode
  readonly checkId?: string
  readonly directory?: string
  readonly producedAt?: string
}

/** A valid result owned by `context` for the given scope directory, check, and mode. */
export async function storedResult(
  context: AppDoctorContext,
  options: StoredResultOptions = {},
): Promise<AppDoctorResult> {
  const scope = await reviewScope(context, options.directory)
  const base = options.mode === 'agent' ? agentResultInput() : staticResultInput()
  const checkId = options.checkId ?? base.check_id
  const input: AppDoctorResultInput = {
    ...base,
    configuration_identity: context.configurationIdentity,
    scope_identity: scope.scopeIdentity,
    scope: scope.descriptor,
    check_id: checkId,
    // Finding codes must equal the owning check id.
    findings: base.findings.map((finding) => ({...finding, code: checkId})),
    ...(options.producedAt === undefined ? {} : {produced_at: options.producedAt}),
  }
  return createAppDoctorResult(input)
}

export const keyOf = (result: AppDoctorResult): AppDoctorResultKey => ({
  scopeIdentity: result.scope_identity,
  checkId: result.check_id,
  mode: result.mode,
})

export const resultsDirectory = (context: AppDoctorContext) => joinPath(context.storeDirectory, 'results')

export const resultPath = (context: AppDoctorContext, result: AppDoctorResult) =>
  joinPath(resultsDirectory(context), resultLeaf(keyOf(result)))

/**
 * The first two real checks from the embedded catalogue. Service tests that record reviews inject this
 * into both the instructions and record dependencies so a publication writes two fsync'd result files
 * instead of the full catalogue, while prompts, hashes and tokens stay genuine.
 */
export function smallCheckCatalogue(): ReadonlyMap<string, Check> {
  return new Map([...loadChecks()].slice(0, 2))
}

export const suppression = (id: string, overrides: Partial<Suppression> = {}): Suppression => ({
  id,
  finding_fingerprint: `sha256:${id.charCodeAt(0).toString(16).padStart(2, '0').repeat(32)}`,
  justification: `Accepted risk for ${id}.`,
  provenance: {source: 'human', actor: 'reviewer', created_at: '2026-09-16T12:00:00.000Z'},
  ...overrides,
})
