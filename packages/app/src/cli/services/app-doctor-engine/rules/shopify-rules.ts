import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

const IDENTIFIER_PATTERN_SOURCE = '[A-Za-z_$][\\w$]*'
const SHOP_FIELD_PATTERN_SOURCE = 'shop(?:_?[iI]d|_?[dD]omain)?'

const REQUEST_FORM_DATA_BINDING_PATTERN = new RegExp(
  `(?:const|let|var)\\s+(${IDENTIFIER_PATTERN_SOURCE})\\s*=\\s*await\\s+(?:req|request)\\.formData\\s*\\(\\s*\\)`,
  'g',
)
const REQUEST_MEMBER_SHOP_ASSIGNMENT_PATTERN = new RegExp(
  `(?:const|let|var)\\s+(${IDENTIFIER_PATTERN_SOURCE})\\s*=\\s*(?:req|request)\\.(?:body|query|params)(?:\\.\\s*${SHOP_FIELD_PATTERN_SOURCE}|\\[\\s*["']${SHOP_FIELD_PATTERN_SOURCE}["']\\s*\\])`,
  'g',
)
const REQUEST_JSON_SHOP_DESTRUCTURE_PATTERN = new RegExp(
  `(?:const|let|var)\\s*\\{[^}]{0,200}\\b(${SHOP_FIELD_PATTERN_SOURCE})\\b[^}]{0,200}\\}\\s*=\\s*await\\s+(?:req|request)\\.json\\s*\\(\\s*\\)`,
  'g',
)
const UNAUTHENTICATED_ADMIN_IDENTIFIER_ARGUMENT_PATTERN = new RegExp(
  `\\bunauthenticated\\.admin\\s*\\(\\s*(${IDENTIFIER_PATTERN_SOURCE})\\s*\\)`,
  'g',
)
const CONFIG_SCRIPT_FIELD_PATTERN =
  /\b(?:external_?script|custom_?js|custom_?script|custom_?javascript|injected_?js|remote_?script)\b/i
const SCRIPT_EXECUTION_SINK_PATTERN =
  /\beval\s*\(|new\s+Function\s*\(|createElement\(\s*["']script["']\s*\)|\.insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(|dangerouslySetInnerHTML|\.(?:inner|outer)HTML\s*=|\.srcdoc\s*=|\.src\s*=/
const SCRIPT_SOURCE_VALIDATION_PATTERN =
  /allow[_-]?list|ALLOWED_(?:SCRIPT|DOMAIN|HOST|SRC)|\bisAllowed\w*\s*\(|\bsanitize\w*\s*\(/i
const SCRIPT_TAG_CREATION_PATTERN = [
  /\bscriptTagCreate\b|\bscriptTagUpdate\b/,
  /\bnew\s+[\w.]*\bScriptTag\s*\(/,
  /\b(?:post|put)\b[^\n]{0,120}script_tags/i,
]
const APP_PROXY_PARAM_READ_PATTERN = /\blogged_in_customer_id\b|\bpath_prefix\b/
const APP_PROXY_VERIFICATION_PATTERN =
  /authenticate\.public\.appProxy|\b[A-Za-z]{0,40}(?:verif|valid|check|assert|authenticat)[A-Za-z]{0,40}(?:proxy|signature|hmac)[A-Za-z]{0,40}\s*\(|createHmac|timingSafeEqual|["']signature["']|\.signature\b/i
const CONFIG_WRITE_PATTERN =
  /metafieldsSet|metafields?\b[^\n]{0,80}(?:set|create|update|write)|\b(?:settings?|config(?:uration)?)\w*\b[^\n]{0,120}\.(?:update|upsert|save|create|updateOne|updateMany|findOneAndUpdate|set)\s*\(|\.(?:update|upsert|updateOne|findOneAndUpdate)\s*\(\s*\{[^}]{0,120}\bshop/i
const SESSION_VERIFICATION_PATTERN =
  /authenticate\.(?:admin|public|webhook|flow|fulfillmentService)|verifyRequest|validateAuthenticatedSession|session[_-]?token|getSessionToken|decodeSessionToken|jwt\.verify|\bverify(?:Jwt|Session|Hmac|Signature)\w*\s*\(|createHmac|timingSafeEqual/i
const WILDCARD_FRAME_ANCESTORS_PATTERN = /frame-ancestors[^;"'`\n]*(?:\s\*(?:\s|;|["'`]|$)|\*\.myshopify\.com)/i
const SHOPIFY_APP_CONTEXT_PATTERN = /@shopify\/shopify-app|@shopify\/shopify-api|myshopify\.com/
const DYNAMIC_POLICY_PATTERN = /frame-ancestors[^;"'`\n]*(?:\$\{|["'`]\s*\+)/i
const stripComments = (content: string): string => {
  let result = ''
  let index = 0
  let quote: string | null = null
  while (index < content.length) {
    const character = content[index]
    const nextCharacter = content[index + 1]
    if (quote !== null) {
      result += character
      if (character === '\\') {
        result += nextCharacter ?? ''
        index += 2
        continue
      }
      if (character === quote) quote = null
      index += 1
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      result += character
      index += 1
      continue
    }
    if (character === '/' && nextCharacter === '/') {
      while (index < content.length && content[index] !== '\n') {
        result += ' '
        index += 1
      }
      continue
    }
    if (character === '/' && nextCharacter === '*') {
      result += '  '
      index += 2
      while (index < content.length && !(content[index] === '*' && content[index + 1] === '/')) {
        result += content[index] === '\n' ? '\n' : ' '
        index += 1
      }
      if (index < content.length) {
        result += '  '
        index += 2
      }
      continue
    }
    result += character
    index += 1
  }
  return result
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const collectBindings = (content: string, pattern: RegExp): Set<string> => {
  const bindings = new Set<string>()
  pattern.lastIndex = 0
  let match = pattern.exec(content)
  while (match !== null) {
    if (match[1]) bindings.add(match[1])
    match = pattern.exec(content)
  }
  return bindings
}

const collectRequestFormDataBindings = (content: string): Set<string> =>
  collectBindings(content, REQUEST_FORM_DATA_BINDING_PATTERN)

const collectRequestControlledShopBindings = (content: string): Set<string> => {
  const bindings = new Set<string>([
    ...collectBindings(content, REQUEST_MEMBER_SHOP_ASSIGNMENT_PATTERN),
    ...collectBindings(content, REQUEST_JSON_SHOP_DESTRUCTURE_PATTERN),
  ])

  for (const formDataBinding of collectRequestFormDataBindings(content)) {
    const formDataShopAssignmentPattern = new RegExp(
      `(?:const|let|var)\\s+(${IDENTIFIER_PATTERN_SOURCE})\\s*=\\s*${escapeRegExp(formDataBinding)}\\.get\\s*\\(\\s*["']${SHOP_FIELD_PATTERN_SOURCE}["']\\s*\\)`,
      'g',
    )
    for (const binding of collectBindings(content, formDataShopAssignmentPattern)) bindings.add(binding)
  }

  return bindings
}

const lineAtIndex = (content: string, index: number): number => content.slice(0, index).split('\n').length

const snippetAtIndex = (content: string, index: number): string =>
  content.slice(index, content.indexOf('\n', index) === -1 ? undefined : content.indexOf('\n', index)).trim()

const makeIssue = (input: {
  id: string
  severity: Issue['severity']
  points: number
  title: string
  message: string
  file: SourceFile
  index: number
  fix: string
  guide?: string
  confidence?: Issue['confidence']
}): Issue => ({
  id: input.id,
  severity: input.severity,
  points: input.points,
  title: input.title,
  message: input.message,
  location: {
    file: input.file.path,
    line: lineAtIndex(input.file.content ?? '', input.index),
  },
  snippet: snippetAtIndex(input.file.content ?? '', input.index),
  fix: {automated: false, description: input.fix, guide: input.guide},
  confidence: input.confidence ?? 'definite',
})

export const scanRequestControlledAdminContext = (files: SourceFile[]): Issue[] => {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const content = stripComments(file.content)
    const requestControlledShopBindings = collectRequestControlledShopBindings(content)
    UNAUTHENTICATED_ADMIN_IDENTIFIER_ARGUMENT_PATTERN.lastIndex = 0
    let match = UNAUTHENTICATED_ADMIN_IDENTIFIER_ARGUMENT_PATTERN.exec(content)
    while (match !== null) {
      if (match[1] && requestControlledShopBindings.has(match[1])) {
        issues.push(
          makeIssue({
            id: 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
            severity: 'critical',
            points: -30,
            title: 'Request input selects Admin API shop context',
            message:
              "A request-controlled shop value is passed to unauthenticated.admin(...), so the caller can choose which shop's Admin API context this route uses.",
            file,
            index: match.index,
            fix: 'Use the Admin API context returned by authenticate.admin(request). Never pass form, JSON, query, or route input into unauthenticated.admin(...).',
            guide:
              'https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/online-access-tokens',
            confidence: 'needs_review',
          }),
        )
      }
      match = UNAUTHENTICATED_ADMIN_IDENTIFIER_ARGUMENT_PATTERN.exec(content)
    }

    for (const formDataBinding of collectRequestFormDataBindings(content)) {
      const directPattern = new RegExp(
        `\\bunauthenticated\\.admin\\s*\\(\\s*${escapeRegExp(formDataBinding)}\\.get\\s*\\(\\s*["']${SHOP_FIELD_PATTERN_SOURCE}["']\\s*\\)\\s*\\)`,
        'g',
      )
      let directMatch = directPattern.exec(content)
      while (directMatch !== null) {
        issues.push(
          makeIssue({
            id: 'REQUEST_CONTROLLED_ADMIN_CONTEXT',
            severity: 'critical',
            points: -30,
            title: 'Request input selects Admin API shop context',
            message:
              "A request-controlled shop value is passed to unauthenticated.admin(...), so the caller can choose which shop's Admin API context this route uses.",
            file,
            index: directMatch.index,
            fix: 'Use the Admin API context returned by authenticate.admin(request). Never pass form, JSON, query, or route input into unauthenticated.admin(...).',
            guide:
              'https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/online-access-tokens',
            confidence: 'needs_review',
          }),
        )
        directMatch = directPattern.exec(content)
      }
    }
  }
  return issues
}

export const scanRuntimeConfigScriptExecution = (files: SourceFile[]): Issue[] => {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const content = stripComments(file.content)
    const match = CONFIG_SCRIPT_FIELD_PATTERN.exec(content)
    if (!match || !SCRIPT_EXECUTION_SINK_PATTERN.test(content) || SCRIPT_SOURCE_VALIDATION_PATTERN.test(content))
      continue
    issues.push(
      makeIssue({
        id: 'RUNTIME_CONFIG_SCRIPT_EXECUTION',
        severity: 'critical',
        points: -25,
        title: 'Runtime config field is executed as script',
        message:
          'A config field named as executable script appears in a file that also injects or evaluates scripts. Config-delivered script bypasses extension versioning and review.',
        file,
        index: match.index,
        fix: 'Ship storefront JavaScript as static versioned extension assets. Treat runtime config as data only, never as executable code or script URLs.',
        confidence: 'needs_review',
      }),
    )
  }
  return issues
}

export const scanDeprecatedScriptTagApi = (files: SourceFile[]): Issue[] => {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const content = stripComments(file.content)
    for (const pattern of SCRIPT_TAG_CREATION_PATTERN) {
      const match = pattern.exec(content)
      if (!match) continue
      issues.push(
        makeIssue({
          id: 'DEPRECATED_SCRIPT_TAG_API',
          severity: 'high',
          points: -12,
          title: 'Deprecated ScriptTag API expands storefront attack surface',
          message:
            'This code uses the deprecated ScriptTag API. ScriptTags run remotely hosted, silently replaceable JavaScript in every storefront session, so a stolen API token or compromised backend can affect every installed shop at once.',
          file,
          index: match.index,
          fix: 'Migrate storefront UI to a theme app extension or analytics to a web pixel instead of creating ScriptTags.',
          guide: 'https://shopify.dev/docs/apps/build/online-store/theme-app-extensions',
        }),
      )
      break
    }
  }
  return issues
}

export const scanAppProxyUnverifiedSignature = (files: SourceFile[]): Issue[] => {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const content = stripComments(file.content)
    const match = APP_PROXY_PARAM_READ_PATTERN.exec(content)
    if (!match || !/\b(?:req|request)\b/.test(content) || APP_PROXY_VERIFICATION_PATTERN.test(content)) continue
    issues.push(
      makeIssue({
        id: 'APP_PROXY_UNVERIFIED_SIGNATURE',
        severity: 'high',
        points: -15,
        title: 'App proxy request trusted without signature verification',
        message:
          'App proxy parameters are read without an obvious signature verification step. Unsigned proxy parameters are attacker-controlled URL input.',
        file,
        index: match.index,
        fix: 'Verify the app proxy signature before trusting shop, logged_in_customer_id, path_prefix, or other proxy parameters. With Shopify App Remix, use authenticate.public.appProxy(request).',
        guide: 'https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies',
        confidence: 'needs_review',
      }),
    )
  }
  return issues
}

export const scanUnscopedShopConfigWrite = (files: SourceFile[]): Issue[] => {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const content = stripComments(file.content)
    const bindings = collectRequestControlledShopBindings(content)
    if (bindings.size === 0 || !CONFIG_WRITE_PATTERN.test(content) || SESSION_VERIFICATION_PATTERN.test(content))
      continue
    const firstBinding = [...bindings][0]
    const matchIndex = firstBinding ? content.indexOf(firstBinding) : 0
    issues.push(
      makeIssue({
        id: 'UNSCOPED_SHOP_CONFIG_WRITE',
        severity: 'high',
        points: -15,
        title: 'Config write trusts shop from request input',
        message:
          'The target shop comes from client-supplied request input and flows into a configuration write without visible session or signature verification.',
        file,
        index: Math.max(0, matchIndex),
        fix: 'Derive the target shop from an authenticated session or verified HMAC, never from request body, query, params, or form data.',
        guide: 'https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens',
        confidence: 'needs_review',
      }),
    )
  }
  return issues
}

export const scanStaticFrameAncestors = (files: SourceFile[]): Issue[] => {
  const issues: Issue[] = []
  for (const file of files) {
    if (!file.content || !['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue
    const content = stripComments(file.content)
    const match = WILDCARD_FRAME_ANCESTORS_PATTERN.exec(content)
    if (!match || !SHOPIFY_APP_CONTEXT_PATTERN.test(content) || DYNAMIC_POLICY_PATTERN.test(content)) continue
    issues.push(
      makeIssue({
        id: 'STATIC_FRAME_ANCESTORS',
        severity: 'high',
        points: -12,
        title: 'Embedded app frame-ancestors uses a wildcard',
        message:
          'This Content-Security-Policy allows any origin or any myshopify.com shop to frame the app. Embedded apps should restrict frame-ancestors to the current shop and admin.shopify.com.',
        file,
        index: match.index,
        fix: 'Build frame-ancestors per request from the authenticated shop domain and admin.shopify.com, or use Shopify App Remix response header helpers.',
        guide: 'https://shopify.dev/docs/apps/build/security/set-up-iframe-protection',
        confidence: 'needs_review',
      }),
    )
  }
  return issues
}
