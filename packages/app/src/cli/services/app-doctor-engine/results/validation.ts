/**
 * Result-local semantic invariants shared by the constructor and the stored
 * parser. Each rule is checked against a single result; nothing here consults
 * other results, catalogues, or the filesystem.
 */
import {sha256} from '../trace/index.js'
import type {AppDoctorAgentResult, AppDoctorResult, AppDoctorStaticResult} from './schema.js'

export type AppDoctorResultOutcome =
  | 'not_run'
  | 'clean'
  | 'findings'
  | 'not_applicable'
  | 'unsupported_framework'
  | 'unresolved'

/** Per check and mode only: `clean` says nothing about other checks or the other mode. */
export function getAppDoctorResultOutcome(result: AppDoctorResult | undefined): AppDoctorResultOutcome {
  if (result === undefined) return 'not_run'
  if (result.execution.status !== 'executed') return result.execution.status
  return result.findings.length === 0 ? 'clean' : 'findings'
}

const sameMembers = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === rightSet.size && [...leftSet].every((item) => rightSet.has(item))
}

const sameSortedList = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  const sortedRight = [...right].sort()
  return left.length === right.length && [...left].sort().every((item, index) => item === sortedRight[index])
}

function validateFindings(result: AppDoctorResult): string[] {
  const errors: string[] = []
  const fingerprints = new Set(result.findings.map((finding) => finding.fingerprint))
  if (fingerprints.size !== result.findings.length) errors.push('findings: duplicate fingerprint')
  if (result.findings.some((finding) => finding.code !== result.check_id)) {
    errors.push('findings: code must equal the owning check ID')
  }
  if (result.mode === 'agent' && result.findings.some((finding) => finding.confidence !== 'agentic')) {
    errors.push('findings: agent findings must have agentic confidence')
  }
  if (
    result.mode === 'static' &&
    result.findings.some((finding) => finding.agent_confidence !== undefined || finding.agent_reasoning !== undefined)
  ) {
    errors.push('findings: static findings must not carry agent confidence or reasoning')
  }
  return errors
}

function validateExecution(result: AppDoctorResult): string[] {
  const errors: string[] = []
  const {execution} = result
  // Only static results carry an `applicable` flag; for them `not_applicable` and `applicable: false` must agree.
  const applicable = result.mode === 'static' ? result.applicable : undefined
  switch (execution.status) {
    case 'executed':
      if (execution.analysis_mode !== 'structured_config' && execution.inspected_files.length === 0) {
        errors.push('execution: executed checks must inspect at least one file')
      }
      if (applicable === false) errors.push('execution: executed checks must be applicable')
      break
    case 'not_applicable':
      if (applicable === true) errors.push('execution: not_applicable requires applicable to be false')
      if (result.findings.length > 0) errors.push('execution: not_applicable results must not retain findings')
      break
    case 'unsupported_framework':
    case 'unresolved':
      if (applicable === false) errors.push('execution: unsupported or unresolved checks must be applicable')
      if (execution.reason === undefined) errors.push('execution: unsupported or unresolved checks require a reason')
      if (execution.guidance === undefined) errors.push('execution: unsupported or unresolved checks require guidance')
      if (execution.status === 'unsupported_framework' && result.findings.length > 0) {
        errors.push('execution: unsupported_framework results must not retain findings')
      }
      break
  }
  return errors
}

function validateImplementations(result: AppDoctorStaticResult): string[] {
  const errors: string[] = []
  const {implementations, execution} = result
  const reportedFindings = implementations.reduce((total, implementation) => total + implementation.findings, 0)
  if (reportedFindings !== result.findings.length) {
    errors.push('implementations: finding counts must sum to the number of findings')
  }
  const inspected = implementations.flatMap((implementation) => implementation.inspected_files)
  if (!sameMembers(inspected, execution.inspected_files)) {
    errors.push('implementations: inspected files must match the execution inspected files')
  }
  // Any executed implementation makes the check executed; otherwise every implementation must agree.
  const statuses = new Set(implementations.map((implementation) => implementation.status))
  const aggregateStatus = statuses.size === 1 ? [...statuses][0] : undefined
  const expectedStatus = statuses.has('executed') ? 'executed' : aggregateStatus
  if (expectedStatus !== execution.status) {
    errors.push('implementations: aggregate status must agree with the implementation statuses')
  }
  return errors
}

function validateCoverage(result: AppDoctorStaticResult): string[] {
  const errors: string[] = []
  const {coverage, execution} = result
  const skippedGaps = coverage.gaps.filter((gap) => gap.code === 'skipped_file')
  if (skippedGaps.some((gap) => gap.file === undefined)) errors.push('coverage: skipped_file gaps require a file')
  const skippedGapFiles = skippedGaps.flatMap((gap) => (gap.file === undefined ? [] : [gap.file]))
  if (
    !sameSortedList(
      skippedGapFiles,
      coverage.files_skipped.map((skipped) => skipped.path),
    )
  ) {
    errors.push('coverage: skipped files and skipped_file gaps must correspond one-to-one')
  }

  const languageGaps = coverage.gaps.filter((gap) => gap.code === 'unsupported_language')
  if (languageGaps.length !== coverage.unsupported_languages.length) {
    errors.push('coverage: unsupported languages and unsupported_language gaps must correspond one-to-one')
  }

  if (coverage.gaps.some((gap) => gap.check_id !== undefined && gap.check_id !== result.check_id)) {
    errors.push('coverage: gaps must not reference other checks')
  }
  const unresolvedGaps = coverage.gaps.filter((gap) => gap.code === 'unresolved_check')
  const ownsUnresolvedGap =
    result.required && (execution.status === 'unsupported_framework' || execution.status === 'unresolved')
  if (ownsUnresolvedGap) {
    if (unresolvedGaps.length !== 1 || unresolvedGaps[0]?.check_id !== result.check_id) {
      errors.push('coverage: a required unresolved check needs exactly one unresolved_check gap for itself')
    }
  } else if (unresolvedGaps.length > 0) {
    errors.push('coverage: only required unresolved checks may declare an unresolved_check gap')
  }
  return errors
}

function validateAgent(result: AppDoctorAgentResult): string[] {
  return result.prompt_hash === sha256(result.prompt) ? [] : ['prompt_hash: does not match the prompt']
}

/** Return every violated invariant as fixed, non-echoing text. Empty when the result is consistent. */
export function validateAppDoctorResultInvariants(result: AppDoctorResult): string[] {
  const modeErrors =
    result.mode === 'static' ? [...validateImplementations(result), ...validateCoverage(result)] : validateAgent(result)
  return [...validateFindings(result), ...validateExecution(result), ...modeErrors]
}
