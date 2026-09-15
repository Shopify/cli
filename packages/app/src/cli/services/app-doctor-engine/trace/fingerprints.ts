import {sha256} from './hash.js'
import type {FindingPartialFingerprints, TraceFinding} from '../types.js'

type FindingIdentity = Pick<TraceFinding, 'source' | 'rule_id' | 'check_id' | 'pattern_id'>

/** Rule/pattern identity deliberately excludes severity, wording, and runner versions. */
export function findingPatternFingerprint(finding: FindingIdentity): string {
  return sha256({
    source: finding.source,
    rule: finding.rule_id ?? finding.check_id,
    pattern: finding.pattern_id ?? null,
  })
}

/**
 * Derive SARIF-style partial identities without replacing the full-content fingerprint.
 * Repeated identical anchors in one file are distinguished by source-order ordinal.
 * With no source anchor, keep only the pattern key: location alone is not a safe
 * cross-run identity for a future persistent suppression.
 */
export function withFindingPartialFingerprints(findings: TraceFinding[]): TraceFinding[] {
  const ordinals = new Map<string, number>()
  const partialByFinding = new Map<TraceFinding, FindingPartialFingerprints>()
  for (const finding of [...findings].sort((left, right) => {
    const fileOrder = left.location.file.localeCompare(right.location.file)
    return (
      fileOrder ||
      (left.location.line ?? 0) - (right.location.line ?? 0) ||
      (left.location.column ?? 0) - (right.location.column ?? 0) ||
      left.fingerprint.localeCompare(right.fingerprint)
    )
  })) {
    const pattern = findingPatternFingerprint(finding)
    const partialFingerprints: FindingPartialFingerprints = {'rulePattern/v1': pattern}
    const anchor = [
      finding.snippet,
      ...finding.evidence
        .filter(
          (evidence) =>
            evidence.location.file === finding.location.file && evidence.location.line === finding.location.line,
        )
        .map((evidence) => evidence.quote),
    ]
      .map((quote) => quote?.trim())
      .find((quote) => Boolean(quote))
    if (anchor) {
      const key = sha256({pattern, file: finding.location.file, anchor: anchor.replace(/\r\n/g, '\n')})
      const ordinal = ordinals.get(key) ?? 0
      ordinals.set(key, ordinal + 1)
      partialFingerprints['occurrence/v1'] = sha256({anchor: key, ordinal})
    }
    partialByFinding.set(finding, partialFingerprints)
  }
  return findings.map((finding) => ({...finding, partial_fingerprints: partialByFinding.get(finding)!}))
}
