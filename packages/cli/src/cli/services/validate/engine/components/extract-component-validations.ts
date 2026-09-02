import {
  type ComponentValidationError,
  type GenericError,
  type ValidationResponse,
  ValidationResult,
} from '../contract.js'
import htmlTags from 'html-tags'
import {svgTagNames} from 'svg-tag-names'
import type ts from 'typescript'

// Maps the raw TypeScript diagnostics produced for a validated snippet onto
// per-Shopify-component errors vs. generic errors, and enforces the
// Shopify-components-only rule for strict UI-extension APIs. Faithful port of
// the source `validation/extractComponentValidations.ts`. The TypeScript
// compiler is injected (`typescript` parameter) so this module — and the whole
// components engine — carries no static dependency on the compiler; the
// type-only `import type ts` is erased at build time.

// TypeScript diagnostic codes.
const DIAGNOSTIC_CODES = {
  NAMESPACE_USED_AS_VALUE: 2708,
  TYPE_NOT_ASSIGNABLE: 2322,
  CANNOT_FIND_NAME: 2304,
} as const

// Regex patterns for parsing diagnostic messages.
const PATTERNS = {
  PROPERTY_NOT_EXIST: /Property '(\w+)' does not exist on type/,
  TYPE_NOT_ASSIGNABLE: /Type '(.+?)' is not assignable to type '(.+?)'/,
  PROPERTY: /[Pp]roperty '(\w+)'/,
  SHOPIFY_MODULE: /@shopify\//,
  MODULE_NOT_FOUND: /Invalid module name in augmentation/,
  INTRINSIC_ELEMENT: /does not exist on type 'JSX.IntrinsicElements'/,
  INVALID_JSX_ELEMENT: /cannot be used as a JSX component|is not a valid JSX element type/,
  USED_BEFORE_BEING_DEFINED: /is used before being assigned/,
  IMPLICITLY_HAS_AN_ANY_TYPE: /implicitly has an 'any' type./,
  // TS strict-mode false positives unrelated to Shopify validation.
  PREACT_REACT_COMPAT: /type '(?:VNode|ReactPortal)|not assignable to type '(?:ReactNode|ReactPortal)'/,
  NEVER_TYPE_CASCADE: /does not exist on type 'never'|is not assignable to type 'never'/,
  PRIMITIVE_PROPERTY_ACCESS:
    /does not exist on type '(?:string|number|boolean|undefined|null|void)(?:\s*\|\s*(?:string|number|boolean|undefined|null|void))*'/,
  CSS_PROPERTIES_COMPAT: /CSSProperties/,
  OBJECT_IS_UNKNOWN: /Object is of type 'unknown'/,
} as const

/**
 * The format of the code block being validated.
 *  - "tsx"/"jsx": React/Preact JSX (the default).
 *  - "html": raw HTML, where every attribute value is a string and native
 *    global attributes (class, style, onclick, ...) are valid.
 */
export type ValidationLanguage = 'html' | 'tsx' | 'jsx'

// Native global HTML attributes valid on any element but absent from the Polaris
// web-component JSX prop interfaces. In HTML mode these must not be flagged.
const HTML_GLOBAL_ATTRIBUTES = new Set([
  'class',
  'style',
  'title',
  'id',
  'slot',
  'role',
  'hidden',
  'lang',
  'dir',
  'tabindex',
  'inert',
  'part',
  'is',
  'nonce',
  'popover',
  'contenteditable',
  'draggable',
  'spellcheck',
  'translate',
  'autocapitalize',
  'autofocus',
  'accesskey',
  'enterkeyhint',
  'inputmode',
])

// Diagnostic target ("expected") type treated as string-coercible in HTML mode:
// a bare numeric/boolean primitive, optionally unioned with undefined/null. A
// literal union such as `'auto' | 'critical'` deliberately does NOT match, so
// bad enum values still fail.
const HTML_SUPPRESSED_TARGET = /^(number|boolean)(\s*\|\s*(number|boolean|undefined|null))*$/

export function isHtmlGlobalAttribute(name: string): boolean {
  return HTML_GLOBAL_ATTRIBUTES.has(name) || /^on[a-z]+$/.test(name)
}

/**
 * True when a TS2322 "not assignable" diagnostic is a string→number/boolean
 * coercion artifact of parsing HTML as JSX. A string→string-literal-union
 * mismatch (`tone="bogus"`) is a real error even in HTML and is NOT suppressed.
 */
export function isHtmlStringCoercion(message: string): boolean {
  const match = message.match(PATTERNS.TYPE_NOT_ASSIGNABLE)
  if (!match) return false
  const actual = match[1]
  const expected = match[2]
  if (actual !== 'string') return false
  return expected !== undefined && HTML_SUPPRESSED_TARGET.test(expected.trim())
}

export interface ComponentValidation {
  componentName: string
  valid: boolean
  errors: ComponentValidationError[]
  skipped?: boolean
}

export function isStandardHTMLElement(tagName: string): boolean {
  // Case-sensitive: HTML elements are lowercase, React components are PascalCase.
  return (htmlTags as string[]).includes(tagName)
}

export function isStandardSVGElement(tagName: string): boolean {
  return (svgTagNames as string[]).includes(tagName)
}

function extractJSXElements(typescript: typeof ts, sourceFile: ts.SourceFile) {
  const elements: {tagName: string; node: ts.Node; start: number; end: number}[] = []

  function visit(node: ts.Node) {
    if (typescript.isJsxOpeningElement(node) || typescript.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile)
      elements.push({tagName, node, start: node.getStart(sourceFile), end: node.getEnd()})
    }
    typescript.forEachChild(node, visit)
  }

  typescript.forEachChild(sourceFile, visit)
  return elements
}

function createSkippedValidation(componentName: string): ComponentValidation {
  return {componentName, valid: true, errors: [], skipped: true}
}

function createDisallowedElementValidation(
  componentName: string,
  elementType: 'HTML' | 'SVG' | 'custom',
): ComponentValidation {
  const message =
    elementType === 'custom'
      ? `Custom component '${componentName}' is not allowed. UI extensions must only use Shopify Polaris web components. If this is a wrapper component, make sure to import it.`
      : `${elementType} element '${componentName}' is not allowed. UI extensions must only use Shopify Polaris web components.`

  return {componentName, valid: false, errors: [{property: 'element', message}]}
}

function sanitizeComponentName(componentName: string): string {
  // <Analytics.CartView> -> <AnalyticsCartView>
  return componentName.replace(/\./g, '')
}

/**
 * Handles non-Shopify components (HTML, SVG, and custom components). Returns a
 * ComponentValidation if the component should be skipped/handled, or null if it
 * should continue to be processed as a Shopify component.
 */
function handleNonShopifyComponent(
  componentName: string,
  shopifyWebComponents: Set<string>,
  userImportedComponents: Set<string>,
  locallyDefinedComponents: Set<string>,
  enforceShopifyOnlyComponents: boolean,
): ComponentValidation | null {
  const sanitizedComponentName = sanitizeComponentName(componentName)

  if (isStandardHTMLElement(sanitizedComponentName)) {
    return enforceShopifyOnlyComponents
      ? createDisallowedElementValidation(componentName, 'HTML')
      : createSkippedValidation(componentName)
  }

  if (isStandardSVGElement(sanitizedComponentName)) {
    return enforceShopifyOnlyComponents
      ? createDisallowedElementValidation(componentName, 'SVG')
      : createSkippedValidation(componentName)
  }

  if (!shopifyWebComponents.has(sanitizedComponentName)) {
    if (enforceShopifyOnlyComponents) {
      // User-imported and locally-defined components are allowed as wrappers.
      if (userImportedComponents.has(sanitizedComponentName)) {
        return createSkippedValidation(componentName)
      }
      if (locallyDefinedComponents.has(sanitizedComponentName)) {
        return createSkippedValidation(componentName)
      }
      return createDisallowedElementValidation(componentName, 'custom')
    }
    return createSkippedValidation(componentName)
  }

  // This is a Shopify component — continue processing.
  return null
}

/** Shopify packages are validated separately, so we only track user-defined imports. */
function isUserDefinedImport(modulePath: string): boolean {
  return !modulePath.startsWith('@shopify/')
}

function collectDefaultImportName(importClause: ts.ImportClause, into: Set<string>): void {
  if (importClause.name) {
    into.add(importClause.name.text)
  }
}

function collectNamedImportNames(typescript: typeof ts, importClause: ts.ImportClause, into: Set<string>): void {
  const {namedBindings} = importClause
  if (namedBindings && typescript.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      into.add(element.name.text)
    }
  }
}

function collectImportedNames(typescript: typeof ts, importClause: ts.ImportClause, into: Set<string>): void {
  collectDefaultImportName(importClause, into)
  collectNamedImportNames(typescript, importClause, into)
}

function getModulePath(typescript: typeof ts, node: ts.ImportDeclaration): string | null {
  const {moduleSpecifier} = node
  if (typescript.isStringLiteral(moduleSpecifier)) {
    return moduleSpecifier.text
  }
  return null
}

function processImportDeclaration(typescript: typeof ts, node: ts.ImportDeclaration, into: Set<string>): void {
  const modulePath = getModulePath(typescript, node)
  if (!modulePath || !isUserDefinedImport(modulePath)) {
    return
  }
  const {importClause} = node
  if (importClause) {
    collectImportedNames(typescript, importClause, into)
  }
}

/**
 * Extracts user-imported component names from the code — components imported
 * from non-Shopify packages, assumed to be wrapper components.
 */
export function extractUserImportedComponents(typescript: typeof ts, sourceFile: ts.SourceFile): Set<string> {
  const userImportedComponents = new Set<string>()

  function visitNode(node: ts.Node): void {
    if (typescript.isImportDeclaration(node)) {
      processImportDeclaration(typescript, node, userImportedComponents)
    }
    typescript.forEachChild(node, visitNode)
  }

  typescript.forEachChild(sourceFile, visitNode)
  return userImportedComponents
}

/** PascalCase names start with an uppercase letter (React/Preact convention). */
function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name)
}

/**
 * Extracts locally-defined component names (function/arrow/class declarations
 * with PascalCase names), assumed to be wrapper components.
 */
export function extractLocallyDefinedComponents(typescript: typeof ts, sourceFile: ts.SourceFile): Set<string> {
  const locallyDefinedComponents = new Set<string>()

  function visitNode(node: ts.Node): void {
    if (typescript.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text
      if (isPascalCase(name)) locallyDefinedComponents.add(name)
    }

    if (typescript.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          typescript.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (typescript.isArrowFunction(declaration.initializer) ||
            typescript.isFunctionExpression(declaration.initializer))
        ) {
          const name = declaration.name.text
          if (isPascalCase(name)) locallyDefinedComponents.add(name)
        }
      }
    }

    if (typescript.isClassDeclaration(node) && node.name) {
      const name = node.name.text
      if (isPascalCase(name)) locallyDefinedComponents.add(name)
    }

    typescript.forEachChild(node, visitNode)
  }

  typescript.forEachChild(sourceFile, visitNode)
  return locallyDefinedComponents
}

function hyphenatedToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function checkHyphenatedAttributes(typescript: typeof ts, node: ts.Node): ComponentValidationError[] {
  if (!typescript.isJsxOpeningElement(node) && !typescript.isJsxSelfClosingElement(node)) {
    return []
  }
  const errors: ComponentValidationError[] = []
  for (const attr of node.attributes.properties) {
    if (!typescript.isJsxAttribute(attr)) continue
    const attrName = typescript.isIdentifier(attr.name) ? attr.name.text : attr.name.getText()
    if (!attrName.includes('-')) continue
    // aria-* and data-* are standard HTML attributes valid on any element.
    if (attrName.startsWith('aria-') || attrName.startsWith('data-')) continue
    const camelCase = hyphenatedToCamelCase(attrName)
    errors.push({
      property: attrName,
      message: `Property '${attrName}' uses a hyphenated name which is not a valid Polaris prop. Use camelCase '${camelCase}' instead.`,
    })
  }
  return errors
}

export interface ExtractComponentValidationsOptions {
  /**
   * When true, HTML/SVG elements and non-Shopify custom components fail
   * validation (UI extensions that must only use Shopify Polaris web components).
   */
  enforceShopifyOnlyComponents?: boolean
  /** Format of the code block. When "html", HTML-legal attribute syntax is accepted. */
  language?: ValidationLanguage
}

export function extractComponentValidations(
  typescript: typeof ts,
  originalCode: string,
  diagnostics: ts.Diagnostic[],
  shopifyWebComponents: Set<string>,
  options: ExtractComponentValidationsOptions = {},
): {validations: ComponentValidation[]; genericErrors: GenericError[]} {
  const {enforceShopifyOnlyComponents = false, language} = options
  const htmlMode = language === 'html'
  const validations: ComponentValidation[] = []
  const handledDiagnostics = new Set<ts.Diagnostic>()

  const sourceFile = typescript.createSourceFile(
    'temp.tsx',
    originalCode,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TSX,
  )

  const elements = extractJSXElements(typescript, sourceFile)

  const userImportedComponents = enforceShopifyOnlyComponents
    ? extractUserImportedComponents(typescript, sourceFile)
    : new Set<string>()

  const locallyDefinedComponents = enforceShopifyOnlyComponents
    ? extractLocallyDefinedComponents(typescript, sourceFile)
    : new Set<string>()

  for (const {tagName: componentName, node, start, end} of elements) {
    const nonShopifyComponentValidationResult = handleNonShopifyComponent(
      componentName,
      shopifyWebComponents,
      userImportedComponents,
      locallyDefinedComponents,
      enforceShopifyOnlyComponents,
    )

    if (nonShopifyComponentValidationResult) {
      validations.push(nonShopifyComponentValidationResult)
      continue
    }

    const {errors, handledDiagnostics: componentHandledDiagnostics} = getComponentErrors(
      typescript,
      start,
      end,
      diagnostics,
      htmlMode,
    )

    componentHandledDiagnostics.forEach((diagnostic) => handledDiagnostics.add(diagnostic))

    // TypeScript silently allows hyphenated attributes on custom elements; check explicitly.
    errors.push(...checkHyphenatedAttributes(typescript, node))

    validations.push({componentName, valid: errors.length === 0, errors})
  }

  const unhandledDiagnostics = diagnostics.filter((diagnostic) => !handledDiagnostics.has(diagnostic))

  const genericErrors: GenericError[] = unhandledDiagnostics
    .filter((diagnostic) => shouldIncludeDiagnostic(typescript, diagnostic, htmlMode))
    .filter((diagnostic) => shouldIncludeGenericDiagnostic(typescript, diagnostic))
    .map((diagnostic) => ({
      message: typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      code: diagnostic.code,
      start: diagnostic.start,
      end:
        diagnostic.start !== undefined && diagnostic.length !== undefined
          ? diagnostic.start + diagnostic.length
          : undefined,
    }))

  return {validations, genericErrors}
}

function shouldIncludeDiagnostic(typescript: typeof ts, diagnostic: ts.Diagnostic, htmlMode = false): boolean {
  if (diagnostic.start === undefined || diagnostic.length === undefined) {
    return false
  }

  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

  if (diagnostic.code === DIAGNOSTIC_CODES.NAMESPACE_USED_AS_VALUE) {
    return false
  }

  // HTML mode: drop false positives that are legal HTML but invalid JSX.
  if (htmlMode) {
    const globalAttrName = message.match(PATTERNS.PROPERTY_NOT_EXIST)?.[1]
    if (globalAttrName !== undefined && isHtmlGlobalAttribute(globalAttrName)) {
      return false
    }
    if (isHtmlStringCoercion(message)) {
      return false
    }
  }

  // eslint-disable-next-line no-restricted-syntax -- 'Cannot find module' must match TypeScript's diagnostic text verbatim
  if (message.includes('Cannot find module') && !message.match(PATTERNS.SHOPIFY_MODULE)) {
    return false
  }

  if (
    message.match(PATTERNS.MODULE_NOT_FOUND) ||
    message.match(PATTERNS.USED_BEFORE_BEING_DEFINED) ||
    message.match(PATTERNS.INVALID_JSX_ELEMENT) ||
    message.match(PATTERNS.IMPLICITLY_HAS_AN_ANY_TYPE)
  ) {
    return false
  }

  return true
}

// Filters TS strict-mode noise from generic (non-component) diagnostics only.
function shouldIncludeGenericDiagnostic(typescript: typeof ts, diagnostic: ts.Diagnostic): boolean {
  const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

  if (
    message.match(PATTERNS.PREACT_REACT_COMPAT) ||
    message.match(PATTERNS.NEVER_TYPE_CASCADE) ||
    message.match(PATTERNS.PRIMITIVE_PROPERTY_ACCESS) ||
    message.match(PATTERNS.CSS_PROPERTIES_COMPAT) ||
    message.match(PATTERNS.OBJECT_IS_UNKNOWN)
  ) {
    return false
  }

  return true
}

function isRelevantDiagnostic(
  typescript: typeof ts,
  diagnostic: ts.Diagnostic,
  componentStart: number,
  componentEnd: number,
  htmlMode = false,
): boolean {
  if (!shouldIncludeDiagnostic(typescript, diagnostic, htmlMode)) {
    return false
  }

  // TS2304 "Cannot find name 'X'" inside a component's range is almost always a
  // snippet-incompleteness artifact (a handler/state identifier defined
  // elsewhere). Demote to a generic error rather than blaming the component.
  if (diagnostic.code === DIAGNOSTIC_CODES.CANNOT_FIND_NAME) {
    return false
  }

  const diagnosticStart = diagnostic.start!
  const diagnosticEnd = diagnostic.start! + diagnostic.length!

  return diagnosticStart >= componentStart && diagnosticEnd <= componentEnd
}

export function getComponentErrors(
  typescript: typeof ts,
  componentStart: number,
  componentEnd: number,
  diagnostics: ts.Diagnostic[],
  htmlMode = false,
): {errors: ComponentValidation['errors']; handledDiagnostics: ts.Diagnostic[]} {
  const errors: ComponentValidation['errors'] = []
  const handledDiagnostics: ts.Diagnostic[] = []

  const relevantDiagnostics = diagnostics.filter((diagnostic) =>
    isRelevantDiagnostic(typescript, diagnostic, componentStart, componentEnd, htmlMode),
  )

  for (const diagnostic of relevantDiagnostics) {
    const message = typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    const error = parseDiagnostic(message)
    if (error) {
      errors.push(error)
      handledDiagnostics.push(diagnostic)
    }
  }

  return {errors, handledDiagnostics}
}

export function parseDiagnostic(message: string): ComponentValidation['errors'][0] | null {
  let property = ''
  let expected: string | undefined
  let actual: string | undefined

  const propertyNotExistMatch = message.match(PATTERNS.PROPERTY_NOT_EXIST)
  if (propertyNotExistMatch) {
    property = propertyNotExistMatch[1] ?? ''
  } else {
    const typeMatch = message.match(PATTERNS.TYPE_NOT_ASSIGNABLE)
    const propMatch = message.match(PATTERNS.PROPERTY)

    if (typeMatch) {
      actual = typeMatch[1]
      expected = typeMatch[2]
    }

    if (propMatch) {
      property = propMatch[1] ?? ''
    }
  }

  return {property: property || 'unknown', message, expected, actual}
}

export function formatValidationResponse(
  validations: ComponentValidation[],
  genericErrors: GenericError[] = [],
): ValidationResponse {
  const errors: string[] = []
  const validComponents: string[] = []
  const skippedComponents: string[] = []

  for (const validation of validations) {
    if (validation.valid) {
      if (validation.skipped) {
        skippedComponents.push(validation.componentName)
      } else {
        validComponents.push(validation.componentName)
      }
    } else {
      for (const error of validation.errors) {
        errors.push(`${validation.componentName} validation failed: Property '${error.property}': ${error.message}`)
      }
    }
  }

  for (const error of genericErrors) {
    errors.push(error.message)
  }

  let resultDetail: string
  let result: ValidationResult

  if (errors.length === 0) {
    result = ValidationResult.SUCCESS
    if (validComponents.length > 0) {
      resultDetail = `All components validated successfully by TypeScript. Found components: ${Array.from(new Set(validComponents)).join(', ')}.`
    } else {
      resultDetail = `No components found to validate by TypeScript.`
    }
  } else {
    result = ValidationResult.FAILED
    resultDetail = `Validation errors:\n${errors.join('\n')}`
  }

  if (skippedComponents.length > 0) {
    resultDetail += `\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n${skippedComponents.map((component) => `  - ${component}`).join('\n')}`
  }

  return {
    result,
    resultDetail,
    componentValidationErrors: validations
      .filter((validation) => !validation.skipped && !validation.valid)
      .flatMap((validation) => validation.errors.map((error) => ({componentName: validation.componentName, ...error}))),
    genericErrors,
    unvalidatedComponents: Array.from(new Set(skippedComponents)),
    validatedComponents: Array.from(new Set(validComponents)),
  }
}
