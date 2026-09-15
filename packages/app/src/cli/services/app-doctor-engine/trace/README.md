# Finding identity and human-readable groups

The scan, JSON output, local trace, and submission each retain one record per
occurrence. Grouping is a presentation view, never a deduplication step in the
scan or compiler. Severity, score, blocking behavior, and check finding counts
continue to use the original occurrences.

## Identity

A trace finding keeps its existing full-content `fingerprint`. Its algorithm and
existing suppression matching are unchanged. It intentionally changes when the
finding's location, evidence, wording, severity, or provenance changes.

New findings also have `partial_fingerprints`, following SARIF's distinction
between rule identity and partial identities used for cross-run matching:

- `rulePattern/v1`: a hash of source, rule/check ID, and optional `pattern_id`.
  This is the human-output grouping key. Severity is a separate display partition
  so a group cannot promote or downgrade any occurrence.
- `occurrence/v1`: a hash of the pattern key, project-relative file, redacted
  source anchor, and ordinal among identical anchors in that file. The anchor
  comes from the snippet or a quote at the primary evidence location. CRLF and
  surrounding whitespace are normalized; line and column numbers are not hashed.

Detector-defined `pattern_id` values distinguish cases with different fixes, such
as Liquid output contexts, secret types, and dependency/advisory sets. They must
remain stable when display text changes. Without a variant, a group represents a
rule category, not a proven shared root cause. Agent checks currently group at
that category level; their messages and evidence remain separate occurrences.

The occurrence key survives unrelated line insertions, wording changes, and rule
version changes when the source anchor is unchanged. It changes for source or
file changes. Identical-anchor ordinals can shift when another identical
occurrence is inserted or removed. When there is no source anchor, no stable
occurrence key is emitted: a path alone is insufficient evidence of identity.
Redacted anchors cannot distinguish replacement secrets with identical surrounding
code. Cross-run consumers must not treat these partial matches as proof that a
previous security decision still applies.

Old v2 traces without partial fingerprints still validate. New partial identities
are recomputed during validation and covered by the trace attestation. Submissions
carry the hashes without adding source paths, quotes, or pattern text.

A future SARIF exporter can map `rule_id`/`check_id` to `ruleId` and
`partial_fingerprints` to `partialFingerprints`. A future persistent suppressions
file can reuse occurrence identity with an explicit ambiguity/staleness policy;
it must not silently substitute a group key for an occurrence key. This change
adds neither a SARIF exporter nor persistent suppression application.

## Display

The default report shows one item per pattern/severity group, including occurrence
and distinct-file counts and up to three sample file/line locations. `--verbose`
expands every occurrence with its own message and fix. The local trace always
contains the full list, including after compiling agent findings.

Patterns in at least 20 files get a separate systemic-pattern triage hint to look
for a shared helper or boundary. This is a presentation threshold, not a security
rating, and does not assert that a common helper exists. Groups remain ordered by
severity and location, never by occurrence count.
