import {reportComponentDefinitions, type ReportComponentName} from './catalog.js'
import {buildReportVisualizationInstructions, buildReportVisualizationRequest} from './prompt.js'
import {createProxyRunner} from '../client.js'
import {Agent} from '@openai/agents'
import {z} from 'zod'
import {isDeepStrictEqual} from 'node:util'
import type {Spec} from '@json-render/core'
import type {StoreReportResult} from '../types.js'

const SPEC_GENERATION_MAX_TURNS = 1
const TOP_LEVEL_KEYS = new Set(['root', 'elements'])
const ELEMENT_KEYS = new Set(['type', 'props', 'children'])

export interface GenerateReportSpecInput {
  report: StoreReportResult
  proxyBaseUrl: string
  proxyToken: string
  model: string
}

export interface RunVisualizationModelParams {
  instructions: string
  request: string
  proxyBaseUrl: string
  proxyToken: string
  model: string
}

export interface ReportSpecDependencies {
  runModel: (params: RunVisualizationModelParams) => Promise<string>
}

export type ReportSpecValidationResult = {success: true; spec: Spec} | {success: false; reason: string}

interface StructurallyValidElement {
  type: ReportComponentName
  props: Record<string, unknown>
  children?: string[]
}

async function runRealVisualizationModel(params: RunVisualizationModelParams): Promise<string> {
  const runner = createProxyRunner(params)
  const agent = new Agent({
    name: 'Store Report Visualization Agent',
    instructions: params.instructions,
    model: params.model,
  })

  const result = await runner.run(agent, params.request, {maxTurns: SPEC_GENERATION_MAX_TURNS})
  return typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput ?? '')
}

const defaultReportSpecDependencies: ReportSpecDependencies = {
  runModel: runRealVisualizationModel,
}

/** Generates the model's complete static report-spec response without streaming it to output. */
export async function generateReportSpecText(
  input: GenerateReportSpecInput,
  dependencies: Partial<ReportSpecDependencies> = {},
): Promise<string> {
  const deps = {...defaultReportSpecDependencies, ...dependencies}

  return deps.runModel({
    instructions: buildReportVisualizationInstructions(),
    request: buildReportVisualizationRequest(input.report),
    proxyBaseUrl: input.proxyBaseUrl,
    proxyToken: input.proxyToken,
    model: input.model,
  })
}

function validationFailure(reason: string): ReportSpecValidationResult {
  return {success: false, reason}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function isPlainJsonValue(value: unknown, ancestors: Set<object> = new Set()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (ancestors.has(value)) return false

  ancestors.add(value)
  if (Array.isArray(value)) {
    const isPlainArray = value.every((item) => isPlainJsonValue(item, ancestors))
    ancestors.delete(value)
    return isPlainArray
  }
  if (!isPlainObject(value)) return false
  const isPlainObjectValue = Object.values(value).every((item) => isPlainJsonValue(item, ancestors))
  ancestors.delete(value)
  return isPlainObjectValue
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function containsDirectiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsDirectiveKey)
  if (!isPlainObject(value)) return false

  return Object.entries(value).some(([key, nestedValue]) => key.startsWith('$') || containsDirectiveKey(nestedValue))
}

function isReportComponentName(value: string): value is ReportComponentName {
  return hasOwn(reportComponentDefinitions, value)
}

/**
 * The published component schemas model optional styling fields as required nullable fields. Fill
 * only those omitted nullable fields, including inside arrays such as Table columns and BarChart
 * data, before strict parsing. Semantic required props remain absent and therefore fail parsing.
 */
function normalizeOmittedNullableFields(schema: z.core.$ZodType, value: unknown): unknown {
  if (schema instanceof z.ZodNullable) {
    return value === null ? null : normalizeOmittedNullableFields(schema.unwrap(), value)
  }

  if (schema instanceof z.ZodOptional) {
    return value === undefined ? undefined : normalizeOmittedNullableFields(schema.unwrap(), value)
  }

  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    return value.map((item) => normalizeOmittedNullableFields(schema.element, item))
  }

  if (!(schema instanceof z.ZodObject) || !isPlainObject(value)) return value

  const normalizedValue: Record<string, unknown> = {...value}
  for (const key of Object.keys(schema.shape)) {
    const propertySchema = schema.shape[key]
    if (!propertySchema) continue

    if (!hasOwn(value, key)) {
      if (z.safeParse(propertySchema, null).success) normalizedValue[key] = null
      continue
    }

    normalizedValue[key] = normalizeOmittedNullableFields(propertySchema, value[key])
  }

  return normalizedValue
}

function describeZodFailure(error: z.ZodError): string {
  const firstIssue = error.issues[0]
  if (!firstIssue) return 'invalid component props'
  const path = firstIssue.path.length === 0 ? '' : ` at ${firstIssue.path.join('.')}`
  return `${firstIssue.message}${path}`
}

function findGraphFailure(root: string, elements: Record<string, StructurallyValidElement>): string | undefined {
  if (!hasOwn(elements, root)) return `Root element "${root}" does not exist.`

  for (const [elementId, element] of Object.entries(elements)) {
    for (const childId of element.children ?? []) {
      if (!hasOwn(elements, childId)) {
        return `Element "${elementId}" references missing child "${childId}".`
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(elementId: string): string | undefined {
    if (visiting.has(elementId)) return `Element graph contains a cycle at "${elementId}".`
    if (visited.has(elementId)) return undefined

    visiting.add(elementId)
    for (const childId of elements[elementId]?.children ?? []) {
      const failure = visit(childId)
      if (failure) return failure
    }
    visiting.delete(elementId)
    visited.add(elementId)
    return undefined
  }

  for (const elementId of Object.keys(elements)) {
    const failure = visit(elementId)
    if (failure) return failure
  }

  return undefined
}

/** Validates an already-parsed value, rejecting dynamic structure before any component schema runs. */
export function validateReportSpec(value: unknown): ReportSpecValidationResult {
  if (!isPlainObject(value) || !isPlainJsonValue(value)) {
    return validationFailure('The report spec must contain only plain JSON values.')
  }
  if (!hasOnlyKeys(value, TOP_LEVEL_KEYS)) {
    return validationFailure('The report spec contains forbidden top-level fields.')
  }
  if (typeof value.root !== 'string' || !isPlainObject(value.elements)) {
    return validationFailure('The report spec must contain a string root and an elements object.')
  }

  // Complete the structural/security pass for every element before invoking any Zod schema. The
  // upstream schemas strip unknown fields, so doing this afterward could silently accept them.
  const structuralElements: Record<string, StructurallyValidElement> = {}
  for (const [elementId, candidate] of Object.entries(value.elements)) {
    if (!isPlainObject(candidate) || !hasOnlyKeys(candidate, ELEMENT_KEYS)) {
      return validationFailure(`Element "${elementId}" contains forbidden fields.`)
    }
    if (typeof candidate.type !== 'string' || !isReportComponentName(candidate.type)) {
      return validationFailure(`Element "${elementId}" uses an unknown component.`)
    }
    if (!isPlainObject(candidate.props)) {
      return validationFailure(`Element "${elementId}" props must be a plain object.`)
    }
    if (containsDirectiveKey(candidate.props)) {
      return validationFailure(`Element "${elementId}" props contain a forbidden $ directive.`)
    }
    if (
      candidate.children !== undefined &&
      (!Array.isArray(candidate.children) || !candidate.children.every((child) => typeof child === 'string'))
    ) {
      return validationFailure(`Element "${elementId}" children must be an array of element ids.`)
    }

    structuralElements[elementId] = {
      type: candidate.type,
      props: candidate.props,
      ...(candidate.children === undefined ? {} : {children: candidate.children}),
    }
  }

  const validatedElements: Record<string, StructurallyValidElement> = {}
  for (const [elementId, element] of Object.entries(structuralElements)) {
    const propsSchema = reportComponentDefinitions[element.type].props
    const normalizedProps = normalizeOmittedNullableFields(propsSchema, element.props)
    const parsedProps = propsSchema.strict().safeParse(normalizedProps)
    if (!parsedProps.success) {
      return validationFailure(`Element "${elementId}" has invalid props: ${describeZodFailure(parsedProps.error)}.`)
    }

    // Nested standard schemas also default to stripping unknown keys. A deep comparison detects
    // any nested field the schema discarded while retaining valid record keys such as Table cells.
    if (!isDeepStrictEqual(parsedProps.data, normalizedProps)) {
      return validationFailure(`Element "${elementId}" props contain unknown fields.`)
    }

    validatedElements[elementId] = {
      type: element.type,
      props: parsedProps.data,
      ...(element.children === undefined ? {} : {children: element.children}),
    }
  }

  const graphFailure = findGraphFailure(value.root, validatedElements)
  if (graphFailure) return validationFailure(graphFailure)

  return {success: true, spec: {root: value.root, elements: validatedElements}}
}

function extractFirstBalancedObject(modelOutput: string): string | undefined {
  let objectStart = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < modelOutput.length; index++) {
    const character = modelOutput[index]

    if (objectStart === -1) {
      if (character === '{') {
        objectStart = index
        depth = 1
      }
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
    } else if (character === '{') {
      depth++
    } else if (character === '}') {
      depth--
      if (depth === 0) return modelOutput.slice(objectStart, index + 1)
    }
  }

  return undefined
}

/** Extracts the first complete JSON object from model text and validates it as a static report spec. */
export function parseAndValidateReportSpec(modelOutput: string): ReportSpecValidationResult {
  const jsonObject = extractFirstBalancedObject(modelOutput)
  if (!jsonObject) return validationFailure('The model response did not contain a complete JSON object.')

  try {
    return validateReportSpec(JSON.parse(jsonObject))
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return validationFailure('The model response contained malformed JSON.')
  }
}
