/**
 * `reference-v1` path references, evidence paths, and the scope descriptor.
 *
 * Everything here is lexical: references are validated for self-consistency
 * and encoding discipline, never resolved against a filesystem. A reference
 * identifies a historical location relative to an opaque storage anchor or an
 * external volume token; it is not an authorised execution root.
 */
import {AppDoctorResultError, describeSchemaIssues} from './error.js'
import {isBoundedJson} from './json.js'
import {redactText} from '../rules/secret-rules.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION = 1 as const
export const APP_DOCTOR_DIAGNOSTIC_PATHS = 'reference-v1' as const

const MAX_REFERENCE_PATH_LENGTH = 4096
export const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/
const BARE_SHA256_HEX = /^[0-9a-f]{64}$/
const CANONICAL_DECIMAL = /^(?:0|[1-9][0-9]*)$/
// A leading drive letter or backslash would make the first component an absolute or UNC root on Windows.
const WINDOWS_ROOT_PREFIX = /^(?:[A-Za-z]:|\\)/
const INVALID_FILE_REFERENCE = 'Invalid App Doctor file reference.'

/** Rewrite Windows separators so producer input compares equal to stored, portable paths. */
export const toPortablePath = (value: string): string => value.replace(/\\/g, '/')

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 0x20 || (code >= 0x7f && code <= 0x9f)
  })
}

function decodeComponent(component: string): string | undefined {
  try {
    return decodeURIComponent(component)
  } catch (error) {
    if (error instanceof URIError) return undefined
    throw error
  }
}

/**
 * A component is transported as `encodeURIComponent(name)`. Requiring the
 * decode → re-encode round trip to be exact gives every filename exactly one
 * spelling, so path comparison and hashing never need a normalisation pass.
 *
 * `%5C` (a literal backslash) is accepted as an opaque character inside a
 * component; consumers must never re-split components on `\`.
 */
function isEncodedComponent(component: string, index: number): boolean {
  const decoded = decodeComponent(component)
  if (decoded === undefined || decoded.length === 0 || decoded === '.' || decoded === '..') return false
  // A lone surrogate survives decoding but makes `encodeURIComponent` throw, so reject it first.
  if (!decoded.isWellFormed()) return false
  if (decoded.includes('/') || hasControlCharacter(decoded)) return false
  if (index === 0 && WINDOWS_ROOT_PREFIX.test(decoded)) return false
  if (encodeURIComponent(decoded) !== component) return false
  // Path components identify files; rewriting them during redaction would silently rename evidence.
  return redactText(decoded) === decoded
}

/**
 * Validate an encoded relative path. `.` denotes the reference base itself and
 * is accepted only when `allowRoot` is set (directory references, not files).
 */
export function isAppDoctorReferencePath(value: string, allowRoot: boolean): boolean {
  if (value === '.') return allowRoot
  if (value.length === 0 || value.length > MAX_REFERENCE_PATH_LENGTH || value.includes('\\')) return false
  return value.split('/').every(isEncodedComponent)
}

const directoryPath = zod
  .string()
  .max(MAX_REFERENCE_PATH_LENGTH)
  .refine((value) => isAppDoctorReferencePath(value, true), 'invalid reference path')
const filePath = zod
  .string()
  .max(MAX_REFERENCE_PATH_LENGTH)
  .refine((value) => isAppDoctorReferencePath(value, false), 'invalid file reference path')
const upLevels = zod.number().int().nonnegative().safe()

const anchorReference = zod.object({base: zod.literal('storage_anchor'), up: upLevels, path: directoryPath}).strict()
const externalVolumeReference = zod
  .object({
    base: zod.literal('external_volume'),
    volume_token: zod.string().regex(SHA256_DIGEST),
    path: directoryPath,
  })
  .strict()

export const AppDoctorPathReferenceSchema = zod.discriminatedUnion('base', [anchorReference, externalVolumeReference])
export type AppDoctorPathReference = zod.infer<typeof AppDoctorPathReferenceSchema>

const inAnchorDirectory = zod
  .object({base: zod.literal('storage_anchor'), up: zod.literal(0), path: directoryPath})
  .strict()
const inAnchorFile = zod.object({base: zod.literal('storage_anchor'), up: zod.literal(0), path: filePath}).strict()

function isInsideAnchor(reference: AppDoctorPathReference): boolean {
  return reference.base === 'storage_anchor' && reference.up === 0
}

/** `undefined` when any component is undecodable; the field refinement has already reported that. */
function decodedComponents(path: string): string[] | undefined {
  if (path === '.') return []
  const components = path.split('/').map(decodeComponent)
  return components.every((component) => component !== undefined) ? components : undefined
}

/**
 * Prefix containment on decoded components: `apps/storefront` contains
 * `apps/storefront/web` but not `apps/storefront-legacy`.
 */
function isInsideAppDirectory(target: AppDoctorPathReference, appDirectoryPath: string): boolean {
  if (!isInsideAnchor(target)) return false
  const appComponents = decodedComponents(appDirectoryPath)
  const targetComponents = decodedComponents(target.path)
  if (appComponents === undefined || targetComponents === undefined) return false
  return (
    appComponents.length <= targetComponents.length &&
    appComponents.every((component, index) => component === targetComponents[index])
  )
}

const boundaryClassification = zod.enum(['inside', 'outside'])

export const AppDoctorScopeDescriptorSchema = zod
  .object({
    descriptor_version: zod.literal(APP_DOCTOR_SCOPE_DESCRIPTOR_VERSION),
    app_directory: inAnchorDirectory,
    selected_config: inAnchorFile,
    directory: AppDoctorPathReferenceSchema,
    boundary: zod.object({app: boundaryClassification, anchor: boundaryClassification}).strict(),
    exclusions: zod
      .object({
        semantics: zod.literal('literal-file-or-subtree-v1'),
        declared_from: zod.literal('selected_config_directory'),
        entries: zod.array(AppDoctorPathReferenceSchema),
      })
      .strict(),
  })
  .strict()
  .superRefine((descriptor, context) => {
    // Zod runs this on dirty output too, so both paths may still be undecodable here.
    // Skip the boundary checks then: the field refinements have already added their issues.
    if (decodedComponents(descriptor.app_directory.path) === undefined) return
    if (decodedComponents(descriptor.directory.path) === undefined) return
    const anchorInside = isInsideAnchor(descriptor.directory)
    if ((descriptor.boundary.anchor === 'inside') !== anchorInside) {
      context.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ['boundary', 'anchor'],
        message: 'anchor boundary disagrees with the target reference',
      })
    }
    const appInside = isInsideAppDirectory(descriptor.directory, descriptor.app_directory.path)
    if ((descriptor.boundary.app === 'inside') !== appInside) {
      context.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ['boundary', 'app'],
        message: 'app boundary disagrees with the target reference',
      })
    }
  })

export type AppDoctorScopeDescriptor = zod.infer<typeof AppDoctorScopeDescriptorSchema>
export type ParseAppDoctorScopeDescriptor =
  | {ok: true; descriptor: AppDoctorScopeDescriptor}
  | {ok: false; errors: string[]}

/**
 * Validate an untrusted descriptor. Does not normalise values or recompute
 * identities; errors are fixed text and never echo the input.
 */
export function parseAppDoctorScopeDescriptor(value: unknown): ParseAppDoctorScopeDescriptor {
  if (!isBoundedJson(value)) return {ok: false, errors: ['scope: expected bounded plain JSON data']}
  const parsed = AppDoctorScopeDescriptorSchema.safeParse(value)
  if (!parsed.success) return {ok: false, errors: describeSchemaIssues(parsed.error.issues)}
  return {ok: true, descriptor: parsed.data}
}

/**
 * Evidence paths name files in a universal namespace shared by both result
 * modes: `anchor/<up>/<path>` or `volume/<64 hex>/<path>`. The file part can
 * never be the bare base (`.`).
 */
export function isAppDoctorEvidencePath(value: string): boolean {
  if (value.length > MAX_REFERENCE_PATH_LENGTH || value.includes('\\')) return false
  const [base, qualifier, ...components] = value.split('/')
  if (qualifier === undefined || !isAppDoctorReferencePath(components.join('/'), false)) return false
  if (base === 'anchor') return CANONICAL_DECIMAL.test(qualifier) && Number.isSafeInteger(Number(qualifier))
  return base === 'volume' && BARE_SHA256_HEX.test(qualifier)
}

/**
 * Format a reference (optionally extended by a file inside it) as an evidence
 * path. Throws `AppDoctorResultError` when the reference or file is invalid or
 * when the combination would name a directory rather than a file.
 */
export function formatAppDoctorEvidencePath(reference: AppDoctorPathReference, relativeFile?: string): string {
  if (!isBoundedJson(reference)) throw new AppDoctorResultError(INVALID_FILE_REFERENCE)
  const parsed = AppDoctorPathReferenceSchema.safeParse(reference)
  if (!parsed.success) throw new AppDoctorResultError(INVALID_FILE_REFERENCE)
  if (relativeFile !== undefined && !isAppDoctorReferencePath(relativeFile, false)) {
    throw new AppDoctorResultError(INVALID_FILE_REFERENCE)
  }

  const basePath = parsed.data.path
  let filePart: string
  if (relativeFile === undefined) filePart = basePath
  else if (basePath === '.') filePart = relativeFile
  else filePart = `${basePath}/${relativeFile}`

  const qualifier =
    parsed.data.base === 'storage_anchor' ? String(parsed.data.up) : parsed.data.volume_token.slice('sha256:'.length)
  const evidencePath = `${parsed.data.base === 'storage_anchor' ? 'anchor' : 'volume'}/${qualifier}/${filePart}`
  if (!isAppDoctorEvidencePath(evidencePath)) throw new AppDoctorResultError(INVALID_FILE_REFERENCE)
  return evidencePath
}
