import {validateTrace} from './app-doctor-engine/index.js'
import {fileExists, fileSize, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorSubmission} from './app-doctor-engine/submission/index.js'
import type {TraceV2} from './app-doctor-engine/types.js'

const MAX_TRACE_FILE_SIZE_BYTES = 5_000_000

export interface AppDoctorArtifactPaths {
  directory: string
  trace: string
  review: string
  submission: string
}

export type ReadTraceResult =
  | {status: 'ok'; trace: TraceV2}
  | {status: 'missing'}
  | {status: 'invalid'; errors: string[]}

export function appDoctorArtifactPaths(appRoot: string): AppDoctorArtifactPaths {
  const directory = joinPath(appRoot, '.shopify', 'app-doctor')
  return {
    directory,
    trace: joinPath(directory, 'trace.json'),
    review: joinPath(directory, 'review.json'),
    submission: joinPath(directory, 'submission.json'),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function readTrace(path: string): Promise<ReadTraceResult> {
  if (!(await fileExists(path))) return {status: 'missing'}

  let content: string
  try {
    if ((await fileSize(path)) > MAX_TRACE_FILE_SIZE_BYTES) {
      return {status: 'invalid', errors: ['The trace file is larger than 5 MB.']}
    }
    content = await readFile(path)
    // Filesystem failures are returned for command-layer rendering.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', errors: [`Could not read the trace file: ${errorMessage(error)}`]}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
    // JSON is an untrusted artifact boundary.
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {status: 'invalid', errors: [`Could not parse JSON: ${errorMessage(error)}`]}
  }

  // Keep validation errors structured. Do not replace this with assertCompatibleTrace,
  // which joins them into one exception string.
  const validation = validateTrace(parsed)
  if (!validation.valid) return {status: 'invalid', errors: validation.errors}

  return {status: 'ok', trace: parsed as TraceV2}
}

export async function writeSubmission(path: string, payload: AppDoctorSubmission): Promise<void> {
  await mkdir(dirname(path))
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`)
}
