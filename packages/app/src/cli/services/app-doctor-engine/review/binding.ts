/**
 * Review binding token: the frozen contract between the `instructions` and
 * `record` subcommands of `shopify app doctor`.
 *
 * Instructions encode which configuration, which scope, and which exact check
 * prompts an agent was asked to review. The agent copies the token verbatim
 * into the record command; record decodes it and refuses documents whose
 * binding no longer matches the current app. The token is opaque to the agent
 * and carries no authority: it explains evidence, it never grants file access.
 */
import {describeSchemaIssues} from '../results/error.js'
import {CHECK_ID_PATTERN, CONFIGURATION_IDENTITY_PATTERN} from '../results/schema.js'
import {AppDoctorScopeDescriptorSchema, SHA256_DIGEST} from '../results/scope.js'
import {canonicalJson} from '../trace/index.js'
import {zod} from '@shopify/cli-kit/node/schema'
import type {AppDoctorScopeDescriptor} from '../results/scope.js'

export const APP_DOCTOR_REVIEW_BINDING_VERSION = 1 as const

const TOKEN_PREFIX = `adr${APP_DOCTOR_REVIEW_BINDING_VERSION}.`
const VERSIONED_PREFIX = /^adr(\d+)\./
const BASE64URL = /^[A-Za-z0-9_-]+$/
/** Real tokens are a few kilobytes; anything near this bound is not worth decoding. */
export const MAX_TOKEN_LENGTH = 262_144

export type AppDoctorReviewBindingErrorCode = 'malformed' | 'unsupported_version' | 'invalid'

const REGENERATE_HINT =
  'Regenerate the instructions with `shopify app doctor instructions` and copy the review token exactly.'

/** Plain `Error`: the engine is a library boundary and callers decide how to surface failures. */
export class AppDoctorReviewBindingError extends Error {
  constructor(
    readonly code: AppDoctorReviewBindingErrorCode,
    detail: string,
  ) {
    super(`${detail} ${REGENERATE_HINT}`)
    this.name = 'AppDoctorReviewBindingError'
  }
}

const nonblank = zod.string().refine((value) => value.trim().length > 0, 'must not be blank')

const BoundCheckSchema = zod
  .object({
    id: zod.string().regex(CHECK_ID_PATTERN, 'must be an uppercase check id'),
    version: zod.number().int().positive().safe(),
    prompt_hash: zod.string().regex(SHA256_DIGEST, 'must be a sha256 digest'),
  })
  .strict()

export const AppDoctorReviewBindingSchema = zod
  .object({
    version: zod.literal(APP_DOCTOR_REVIEW_BINDING_VERSION),
    configuration_identity: zod.string().regex(CONFIGURATION_IDENTITY_PATTERN, 'must be 32 lowercase hex characters'),
    scope_identity: zod.string().regex(SHA256_DIGEST, 'must be a sha256 digest'),
    scope: AppDoctorScopeDescriptorSchema,
    checks: zod
      .array(BoundCheckSchema)
      .min(1)
      .refine(
        (checks) => checks.every((check, index) => index === 0 || checks[index - 1]!.id < check.id),
        'must be sorted by id without repeats',
      ),
    engine: zod.object({name: nonblank, version: nonblank}).strict(),
  })
  .strict()

export interface AppDoctorReviewBinding {
  readonly version: typeof APP_DOCTOR_REVIEW_BINDING_VERSION
  readonly configuration_identity: string
  readonly scope_identity: string
  readonly scope: AppDoctorScopeDescriptor
  /** Sorted by id; one entry per check whose prompt the agent received. */
  readonly checks: ReadonlyArray<{readonly id: string; readonly version: number; readonly prompt_hash: string}>
  readonly engine: {readonly name: string; readonly version: string}
}

/** `adr1.` followed by the base64url canonical JSON of the binding. Key order never affects the token. */
export function encodeAppDoctorReviewBinding(binding: AppDoctorReviewBinding): string {
  return `${TOKEN_PREFIX}${Buffer.from(canonicalJson(binding), 'utf8').toString('base64url')}`
}

function decodePayload(payload: string): unknown {
  const bytes = Buffer.from(payload, 'base64url')
  // Node's decoder silently drops characters it can't place, so require an exact round trip.
  if (payload.length === 0 || !BASE64URL.test(payload) || bytes.toString('base64url') !== payload) {
    throw new AppDoctorReviewBindingError('malformed', "The review token isn't valid base64url.")
  }
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppDoctorReviewBindingError('malformed', "The review token doesn't contain JSON.")
    }
    throw error
  }
}

function payloadVersion(payload: unknown): unknown {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).version
    : undefined
}

/** Strictly decode an untrusted token. Error messages never echo the token's contents. */
export function decodeAppDoctorReviewBinding(token: unknown): AppDoctorReviewBinding {
  if (typeof token !== 'string') {
    throw new AppDoctorReviewBindingError('malformed', 'The review token must be a string.')
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new AppDoctorReviewBindingError('malformed', 'The review token is too long.')
  }
  const prefixMatch = VERSIONED_PREFIX.exec(token)
  if (prefixMatch && Number(prefixMatch[1]) !== APP_DOCTOR_REVIEW_BINDING_VERSION) {
    throw new AppDoctorReviewBindingError(
      'unsupported_version',
      `The review token was produced for an unsupported token version (${prefixMatch[1]}).`,
    )
  }
  if (!token.startsWith(TOKEN_PREFIX)) {
    throw new AppDoctorReviewBindingError('malformed', `The review token must start with ${TOKEN_PREFIX}`)
  }
  const payload = decodePayload(token.slice(TOKEN_PREFIX.length))
  const version = payloadVersion(payload)
  if (version !== undefined && version !== APP_DOCTOR_REVIEW_BINDING_VERSION) {
    throw new AppDoctorReviewBindingError(
      'unsupported_version',
      'The review token was produced for an unsupported binding version.',
    )
  }
  const parsed = AppDoctorReviewBindingSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AppDoctorReviewBindingError(
      'invalid',
      `The review token is invalid (${describeSchemaIssues(parsed.error.issues).join('; ')}).`,
    )
  }
  return parsed.data
}
