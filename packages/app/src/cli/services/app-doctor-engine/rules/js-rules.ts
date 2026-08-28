import {parse} from 'acorn'
import {simple} from 'acorn-walk'
import type {Issue} from '../types.js'
import type {SourceFile} from './types.js'

interface InspectableNode {
  type: string
  name?: string
  value?: unknown
  operator?: string
  left?: unknown
  right?: unknown
  property?: InspectableNode
  object?: InspectableNode
  callee?: InspectableNode
  arguments?: unknown[]
  expressions?: unknown[]
  loc?: {start?: {line?: number}}
}

function isInspectableNode(value: unknown): value is InspectableNode {
  return value !== null && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

/** Rule 4: UNSAFE_INNERHTML (-25, critical) */
export function scanUnsafeInnerHTML(files: SourceFile[]): Issue[] {
  const issues: Issue[] = []

  for (const file of files) {
    if (!file.content) continue
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(file.ext)) continue

    let ast
    try {
      ast = parse(file.content, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        allowReturnOutsideFunction: true,
      })
      // Unsupported syntax falls back to the conservative regex scanner.
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      issues.push(...scanUnsafeInnerHTMLRegex(file))
      continue
    }

    simple(ast, {
      AssignmentExpression(node) {
        const expression = node as InspectableNode
        // Detect: element.innerHTML = <non-literal>
        const left = expression.left as InspectableNode | undefined
        if (
          left?.type === 'MemberExpression' &&
          (left.property?.name === 'innerHTML' || left.property?.value === 'innerHTML') &&
          !isStringLiteral(expression.right)
        ) {
          issues.push(
            makeInnerHtmlIssue(file, expression.loc?.start?.line, expression.left, assessConfidence(expression.right)),
          )
        }
        // Detect: element.outerHTML = <non-literal>
        if (
          left?.type === 'MemberExpression' &&
          (left.property?.name === 'outerHTML' || left.property?.value === 'outerHTML') &&
          !isStringLiteral(expression.right)
        ) {
          issues.push(makeOuterHtmlIssue(file, expression.loc?.start?.line))
        }
      },
      CallExpression(node) {
        const expression = node as InspectableNode
        // Detect: element.insertAdjacentHTML(position, <non-literal>)
        const callee = expression.callee
        if (
          callee?.type === 'MemberExpression' &&
          (callee.property?.name === 'insertAdjacentHTML' || callee.property?.value === 'insertAdjacentHTML')
        ) {
          const secondArg = expression.arguments?.[1]
          if (secondArg && !isStringLiteral(secondArg)) {
            issues.push(makeInsertAdjacentIssue(file, expression.loc?.start?.line))
          }
        }
      },
    })
  }

  return issues
}

function isStringLiteral(node: unknown): boolean {
  if (!isInspectableNode(node)) return false
  if (node.type === 'Literal' && typeof node.value === 'string') return true
  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0) return true
  // String concatenation of only literals is safe
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isStringLiteral(node.left) && isStringLiteral(node.right)
  }
  return false
}

/**
 * Determine confidence for an innerHTML/outerHTML assignment.
 * If the RHS is a template literal whose expressions are all literals/numbers,
 * it's probably not XSS — mark as needs_review.
 * If the RHS contains request-controlled sources (searchParams, formData, request.body),
 * it's definite.
 * Member expressions on non-request objects (e.g. product.star_rating) are
 * needs_review — they could be user-controlled but usually aren't HTML.
 */
function assessConfidence(node: unknown): 'definite' | 'needs_review' {
  if (!isInspectableNode(node)) return 'definite'

  // Check for request-controlled sources anywhere in the expression
  if (containsRequestControlledData(node)) return 'definite'

  // Template literal: check expressions
  if (node.type === 'TemplateLiteral') {
    const expressions = node.expressions ?? []
    // An expression-free template contains only static text.
    if (expressions.length === 0) return 'needs_review'
    const allSafe = expressions.every((expression) => isLikelySafeExpression(expression))
    return allSafe ? 'needs_review' : 'definite'
  }

  // Binary expression (string concat): check both sides
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isLikelySafeExpression(node.left) && isLikelySafeExpression(node.right) ? 'needs_review' : 'definite'
  }

  // Direct identifier or call expression — can't know if user-controlled
  return 'needs_review'
}

/** Check if an expression tree contains request-controlled data sources. */
function containsRequestControlledData(node: unknown): boolean {
  if (!isInspectableNode(node)) return false
  if (node.type === 'CallExpression') {
    const callee = node.callee
    // searchParams.get(), formData.get(), request.body, etc.
    if (callee?.type === 'MemberExpression') {
      const prop = callee.property?.name ?? callee.property?.value
      if (prop === 'get' || prop === 'getBoolean' || prop === 'getFloat') {
        const obj = callee.object
        const objProp = obj?.property?.name ?? obj?.property?.value
        if (objProp === 'searchParams' || objProp === 'query' || objProp === 'params') return true
      }
    }
    // Check arguments recursively
    for (const arg of node.arguments ?? []) {
      if (containsRequestControlledData(arg)) return true
    }
  }
  if (node.type === 'MemberExpression') {
    const objProp = node.object?.property?.name ?? node.object?.property?.value
    if (
      node.object?.type === 'Identifier' &&
      typeof node.object.name === 'string' &&
      /^(request|req|event)$/.test(node.object.name)
    )
      return true
    if (objProp === 'body' || objProp === 'query' || objProp === 'params') return true
  }
  // Recurse into binary expressions and template literals
  if (node.type === 'BinaryExpression') {
    return containsRequestControlledData(node.left) || containsRequestControlledData(node.right)
  }
  if (node.type === 'TemplateLiteral') {
    return (node.expressions ?? []).some((expression) => containsRequestControlledData(expression))
  }
  return false
}

/**
 * A "likely safe" expression is one that's probably not user-controlled HTML:
 * - Literals (strings, numbers, booleans)
 * - Member expressions on non-request objects (product.title, item.price)
 * - Call expressions on literals (.repeat(), .toString())
 * - Binary expressions combining safe expressions
 */
function isLikelySafeExpression(node: unknown): boolean {
  if (!isInspectableNode(node)) return false
  if (isLiteralOrNumeric(node)) return true
  // Member expressions on non-request identifiers (product.star_rating)
  if (node.type === 'MemberExpression' && !containsRequestControlledData(node)) return true
  // Binary expressions of safe parts
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isLikelySafeExpression(node.left) && isLikelySafeExpression(node.right)
  }
  return false
}

function isLiteralOrNumeric(node: unknown): boolean {
  if (!isInspectableNode(node)) return false
  // Literal strings, numbers, and booleans are safe.
  if (node.type === 'Literal') return true
  if (node.type === 'TemplateLiteral' && (node.expressions ?? []).length === 0) return true
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isLiteralOrNumeric(node.left) && isLiteralOrNumeric(node.right)
  }
  // Member expressions like '⭐'.repeat() are technically callable but the
  // result of String.prototype.repeat on a literal is still a literal.
  if (node.type === 'CallExpression') {
    const callee = node.callee
    if (callee?.type === 'MemberExpression') {
      const prop = callee.property?.value ?? callee.property?.name
      if (prop === 'repeat' && isLiteralOrNumeric(callee.object)) return true
    }
  }
  return false
}

function makeInnerHtmlIssue(
  file: SourceFile,
  line: number | undefined,
  left: unknown,
  confidence: 'definite' | 'needs_review' = 'definite',
): Issue {
  return {
    id: 'UNSAFE_INNERHTML',
    severity: 'critical',
    points: -25,
    title: 'Unsafe innerHTML assignment',
    message:
      'innerHTML is assigned a non-literal value. This can lead to XSS if the value contains user-controlled data. Use textContent instead, or sanitize with DOMPurify.',
    location: {file: file.path, line},
    snippet: left ? `innerHTML = ...` : undefined,
    fix: {
      automated: false,
      description: 'Replace innerHTML with textContent, or add DOMPurify.sanitize()',
      guide: 'https://shopify.dev/docs/apps/online-store/security#xss-prevention',
    },
    confidence,
  }
}

function makeOuterHtmlIssue(file: SourceFile, line: number | undefined): Issue {
  return {
    id: 'UNSAFE_INNERHTML',
    severity: 'critical',
    points: -25,
    title: 'Unsafe outerHTML assignment',
    message:
      'outerHTML is assigned a non-literal value. This can lead to XSS. Use textContent or sanitize with DOMPurify.',
    location: {file: file.path, line},
    fix: {
      automated: false,
      description: 'Replace outerHTML with textContent, or add DOMPurify.sanitize()',
    },
  }
}

function makeInsertAdjacentIssue(file: SourceFile, line: number | undefined): Issue {
  return {
    id: 'UNSAFE_INNERHTML',
    severity: 'critical',
    points: -25,
    title: 'Unsafe insertAdjacentHTML call',
    message:
      'insertAdjacentHTML is called with a non-literal value. This can lead to XSS. Use textContent or sanitize with DOMPurify.',
    location: {file: file.path, line},
    fix: {
      automated: false,
      description: 'Replace insertAdjacentHTML with textContent, or add DOMPurify.sanitize()',
    },
  }
}

/** Regex fallback when AST parsing fails */
function scanUnsafeInnerHTMLRegex(file: SourceFile): Issue[] {
  const issues: Issue[] = []
  const lines = file.content!.split('\n')

  for (const [i, line] of lines.entries()) {
    // innerHTML = <not a string literal>
    const innerMatch = line.match(/\.innerHTML\s*=\s*([^;"'`]+)/)
    const innerValue = innerMatch?.[1]?.trim()
    if (
      innerValue !== undefined &&
      !innerValue.startsWith("'") &&
      !innerValue.startsWith('"') &&
      !innerValue.startsWith('`')
    ) {
      issues.push(makeInnerHtmlIssue(file, i + 1, null))
    }
    // insertAdjacentHTML(..., <not a string literal>)
    const insertMatch = line.match(/\.insertAdjacentHTML\s*\([^,]+,\s*([^)]+)/)
    const insertedValue = insertMatch?.[1]?.trim()
    if (
      insertedValue !== undefined &&
      !insertedValue.startsWith("'") &&
      !insertedValue.startsWith('"') &&
      !insertedValue.startsWith('`')
    ) {
      issues.push(makeInsertAdjacentIssue(file, i + 1))
    }
  }
  return issues
}
