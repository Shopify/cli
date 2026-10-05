/**
 * Each secret pattern MUST place the sensitive material in capture group 1
 * (or make the whole match sensitive when `wholeMatch` is set), because
 * redaction uses the pattern's match instead of a separately-maintained regex.
 *
 * Detection patterns are reused by redaction, so a pattern that can produce a
 * finding always redacts the exact same span.
 */
interface SecretPattern {
  regex: RegExp
  name: string
  /** When true the entire match is the secret; otherwise capture group 1 is. */
  wholeMatch?: boolean
  /** When true no part of the input is safe to retain after this pattern matches. */
  redactEntireInput?: boolean
}

// Shopify credentials are recognized by value prefix, never by variable or
// key name — a secret-sounding name with a placeholder value (as in committed
// `.env.example` files) is not evidence of a leak.
// shpat_/shpca_/shppa_/shpss_ bodies are hex; shprt_/shpsb_/shptka_/shpua_
// are alphanumeric. The first seven prefixes are already public via
// shopify.dev docs and published secret-scanning rules (gitleaks, GitHub
// partner patterns); shpua_ marks tokens issued while an app is still in
// development — the most likely to be committed.
const SHOPIFY_TOKEN_PATTERN: SecretPattern = {
  regex: /shp(?:(?:at|ca|pa|ss)_[a-fA-F0-9]{16,}|(?:rt|sb|tka|ua)_[a-zA-Z0-9]{16,})/,
  name: 'Shopify token',
  wholeMatch: true,
}

/**
 * Patterns that can emit COMMITTED_SECRET findings.
 *
 * Keep this list limited to Shopify credentials. The app security scan should
 * not duplicate general-purpose secret scanners for third-party providers.
 */
export const SHOPIFY_SECRET_PATTERNS: SecretPattern[] = [SHOPIFY_TOKEN_PATTERN]

/**
 * Patterns used only to prevent known credentials from being echoed in scanner
 * and agent output. They never produce findings unless they are also listed in
 * SHOPIFY_SECRET_PATTERNS.
 */
const REDACTION_PATTERNS: SecretPattern[] = [
  SHOPIFY_TOKEN_PATTERN,
  // Stripe secret/restricted keys. Publishable `pk_` keys are public by design.
  {
    regex: /(?:sk|rk)_(?:live|test)_[a-zA-Z0-9]{20,}/,
    name: 'Stripe API key',
    wholeMatch: true,
  },
  // AWS access key ID
  {regex: /AKIA[0-9A-Z]{16}/, name: 'AWS access key', wholeMatch: true},
  // AWS secret access key (40 char base64-ish, assignment context to limit noise)
  {
    regex: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"]([A-Za-z0-9/+=]{40})['"]/i,
    name: 'AWS secret access key',
  },
  // GitHub tokens
  {
    regex: /gh[pousr]_[A-Za-z0-9]{36,}/,
    name: 'GitHub token',
    wholeMatch: true,
  },
  // Google API key
  {regex: /AIza[0-9A-Za-z_-]{35}/, name: 'Google API key', wholeMatch: true},
  // Slack token
  {
    regex: /xox[baprs]-[0-9A-Za-z-]{10,}/,
    name: 'Slack token',
    wholeMatch: true,
  },
  // Match complete blocks first so arbitrary multiline output never retains key material or its footer.
  {
    regex: /-----BEGIN ((?:(?:RSA|EC|OPENSSH) )?PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----[\s\S]*?-----END \1-----/,
    name: 'private key block',
    wholeMatch: true,
  },
  // Keep a header-only detector for line-oriented repository scanning and malformed/truncated keys.
  {
    regex: /-----BEGIN (?:(?:RSA|EC|OPENSSH) )?PRIVATE KEY-----|-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    name: 'private key',
    wholeMatch: true,
    redactEntireInput: true,
  },
]

/**
 * Redact a line using the pattern that matched it.
 *
 * The redacted span is taken from the matching detection or redaction pattern.
 * Never returns the raw secret.
 */
export function redactMatch(line: string, pattern: SecretPattern): string {
  const match = pattern.regex.exec(line)
  if (!match) return '[REDACTED]'
  if (pattern.redactEntireInput) return '[REDACTED LINE]'

  const secret = pattern.wholeMatch ? match[0] : match[1]
  if (!secret) return '[REDACTED]'

  // Keep a short prefix for identification (e.g. "AKIA…") but never enough to use.
  const keep = Math.min(4, Math.floor(secret.length / 4))
  const hint = keep > 0 ? secret.slice(0, keep) : ''
  const replaced = line.split(secret).join(`${hint}[REDACTED:${secret.length}]`)

  // Belt and braces: if the secret somehow survived, drop the line entirely.
  return replaced.includes(secret) ? '[REDACTED LINE]' : replaced
}

/** Redact every known secret occurrence from arbitrary scanner or agent text. */
export function redactText(text: string): string {
  let redacted = text
  for (const pattern of REDACTION_PATTERNS) {
    // Patterns deliberately have no global flag. Re-run until all occurrences
    // are removed, with a guard against a future non-progressing pattern.
    for (let count = 0; count < 100; count++) {
      const match = pattern.regex.exec(redacted)
      if (!match) break
      const next = redactMatch(redacted, pattern)
      if (next === redacted) return '[REDACTED TEXT]'
      redacted = next
    }
    // Fail closed when hostile input contains more matches than the work cap.
    if (pattern.regex.test(redacted)) return '[REDACTED TEXT]'
  }
  return redacted
}
