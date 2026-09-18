/**
 * Review-scope selection for agent instructions.
 *
 * Turns the caller's directory spellings into canonical, deduplicated scopes
 * with the descriptor their results will carry. This is not scan-discovery
 * authority: it only stats and realpaths the requested directories and never
 * lists their contents.
 */
import {appDoctorScopeIdentity, canonicalLocation, containsPath, projectAppDoctorPath} from './paths.js'
import {AppDoctorScopeError} from './types.js'
import {isMissingPathError, systemErrorCode} from '../context/fs-errors.js'
import {compareStrings} from '../context/ordering.js'
import {APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION, parseAppDoctorScopeDescriptor} from '../results/scope.js'
import {fileRealPath, isDirectory} from '@shopify/cli-kit/node/fs'
import {isAbsolutePath, normalizePath, resolvePath} from '@shopify/cli-kit/node/path'
import type {AppDoctorReviewScope} from './types.js'
import type {AppDoctorContext} from '../context/types.js'
import type {AppDoctorScopeDescriptor} from '../results/scope.js'

export interface AppDoctorReviewScopeOptions {
  /** Directories to review. Omitted means the app root; provided lists replace it entirely. */
  readonly reviewDirectories?: ReadonlyArray<string>
  /** Absolute directory that relative entries resolve against. */
  readonly invocationDirectory: string
}

interface CanonicalizedRequest {
  readonly requestedPath: string
  readonly directory: string
}

async function canonicalizeReviewDirectory(
  requestedPath: string,
  invocationDirectory: string,
): Promise<CanonicalizedRequest> {
  if (requestedPath.trim().length === 0) {
    throw new AppDoctorScopeError('INVALID_REVIEW_DIRECTORY', 'Review directories must not be blank.')
  }
  const absolutePath = resolvePath(invocationDirectory, requestedPath)
  let realPath: string
  try {
    realPath = await fileRealPath(absolutePath)
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new AppDoctorScopeError('REVIEW_DIRECTORY_NOT_FOUND', `${absolutePath} does not exist.`)
    }
    throw new AppDoctorScopeError(
      'IO_ERROR',
      `Couldn't resolve ${absolutePath} (${systemErrorCode(error) ?? 'unknown'}).`,
    )
  }
  // `fileRealPath` preserves the caller's drive-letter casing on Windows, so `c:\repo` and `C:\repo` would
  // otherwise become two scopes with one identity. `canonicalLocation` makes the key match the identity.
  const directory = canonicalLocation(normalizePath(realPath))
  if (!(await isDirectory(directory))) {
    throw new AppDoctorScopeError('REVIEW_DIRECTORY_NOT_A_DIRECTORY', `${absolutePath} is not a directory.`)
  }
  return {requestedPath, directory}
}

/** Group requests by canonical directory, keeping each distinct spelling once in request order. */
function groupByDirectory(requests: ReadonlyArray<CanonicalizedRequest>): Map<string, string[]> {
  return requests.reduce((groups, {directory, requestedPath}) => {
    const spellings = groups.get(directory) ?? []
    if (!spellings.includes(requestedPath)) spellings.push(requestedPath)
    return groups.set(directory, spellings)
  }, new Map<string, string[]>())
}

type InAnchorReference = AppDoctorScopeDescriptor['app_directory']

/** The app directory and selected configuration always sit inside the anchor; anything else is a context bug. */
function projectInAnchorPath(storageAnchor: string, canonicalAbsolutePath: string): InAnchorReference {
  const reference = projectAppDoctorPath(storageAnchor, canonicalAbsolutePath)
  if (reference.base !== 'storage_anchor' || reference.up !== 0) {
    throw new AppDoctorScopeError(
      'DESCRIPTOR_INVALID',
      `${canonicalAbsolutePath} is outside the storage anchor ${storageAnchor}.`,
    )
  }
  return {base: reference.base, up: 0, path: reference.path}
}

function buildDescriptor(context: AppDoctorContext, directory: string): AppDoctorScopeDescriptor {
  const anchor = context.storageAnchor
  const candidate: AppDoctorScopeDescriptor = {
    descriptor_version: APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION,
    app_directory: projectInAnchorPath(anchor, context.appRoot),
    selected_config: projectInAnchorPath(anchor, context.configurationPath),
    directory: projectAppDoctorPath(anchor, directory),
    boundary: {
      app: containsPath(context.appRoot, directory) ? 'inside' : 'outside',
      anchor: containsPath(anchor, directory) ? 'inside' : 'outside',
    },
    // PR1 records no exclusions; declared exclusions are ingested by a later change.
    exclusions: {semantics: 'literal-file-or-subtree-v1', declared_from: 'selected_config_directory', entries: []},
  }
  // The type is already right; parsing enforces the contract's semantic refinements, e.g. that the boundary
  // classification agrees with the references and that no path component would be rewritten by secret redaction.
  const parsed = parseAppDoctorScopeDescriptor(candidate)
  if (!parsed.ok) {
    throw new AppDoctorScopeError(
      'DESCRIPTOR_INVALID',
      `${directory} can't be described as a review scope: ${parsed.errors.join('; ')}`,
    )
  }
  return parsed.descriptor
}

function buildReviewScope(
  context: AppDoctorContext,
  canonicalAppRoot: string,
  directory: string,
  requestedPaths: string[],
): AppDoctorReviewScope {
  return {
    scopeIdentity: appDoctorScopeIdentity(context.storageAnchor, directory),
    directory,
    requestedPaths,
    descriptor: buildDescriptor(context, directory),
    isAppRoot: directory === canonicalAppRoot,
  }
}

/**
 * Resolve the directories an agent review should cover. Aliases of one
 * directory coalesce into a single scope; nested directories stay distinct.
 * Output is ordered by canonical directory so instructions are deterministic.
 */
export async function buildAppDoctorReviewScopes(
  context: AppDoctorContext,
  options: AppDoctorReviewScopeOptions,
): Promise<AppDoctorReviewScope[]> {
  if (!isAbsolutePath(options.invocationDirectory)) {
    throw new AppDoctorScopeError(
      'INVALID_PATH',
      `The invocation directory must be absolute, got ${options.invocationDirectory}.`,
    )
  }
  const requestedPaths = options.reviewDirectories ?? [context.appRoot]
  if (requestedPaths.length === 0) {
    throw new AppDoctorScopeError('NO_REVIEW_DIRECTORIES', 'At least one review directory is required.')
  }

  // Sequential so the first failing entry in request order always determines the reported error.
  const requests: CanonicalizedRequest[] = []
  for (const requestedPath of requestedPaths) {
    // eslint-disable-next-line no-await-in-loop
    requests.push(await canonicalizeReviewDirectory(requestedPath, options.invocationDirectory))
  }
  const canonicalAppRoot = canonicalLocation(context.appRoot)
  return [...groupByDirectory(requests).entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([directory, spellings]) => buildReviewScope(context, canonicalAppRoot, directory, spellings))
}
