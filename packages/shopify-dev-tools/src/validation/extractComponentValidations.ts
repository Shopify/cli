/**
 * Component validation logic using TypeScript AST
 */

import htmlTags from "html-tags";
import ts from "typescript";
import {
  ComponentValidationError,
  GenericError,
  ValidationResponse,
  ValidationResult,
} from "../types/index.js";
import { svgTagNames } from "svg-tag-names";

// TypeScript diagnostic codes
// See: https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/diagnosticMessages.json
const DIAGNOSTIC_CODES = {
  NAMESPACE_USED_AS_VALUE: 2708,
  TYPE_NOT_ASSIGNABLE: 2322,
  CANNOT_FIND_NAME: 2304,
} as const;

// Regex patterns for parsing diagnostic messages
const PATTERNS = {
  PROPERTY_NOT_EXIST: /Property '(\w+)' does not exist on type/,
  TYPE_NOT_ASSIGNABLE: /Type '(.+?)' is not assignable to type '(.+?)'/,
  PROPERTY: /[Pp]roperty '(\w+)'/,
  SHOPIFY_MODULE: /@shopify\//,
  MODULE_NOT_FOUND: /Invalid module name in augmentation/,
  INTRINSIC_ELEMENT: /does not exist on type 'JSX.IntrinsicElements'/,
  INVALID_JSX_ELEMENT:
    /cannot be used as a JSX component|is not a valid JSX element type/,
  USED_BEFORE_BEING_DEFINED: /is used before being assigned/,
  IMPLICITLY_HAS_AN_ANY_TYPE: /implicitly has an 'any' type./,
  // TS strict-mode false positives unrelated to Shopify validation
  PREACT_REACT_COMPAT:
    /type '(?:VNode|ReactPortal)|not assignable to type '(?:ReactNode|ReactPortal)'/,
  NEVER_TYPE_CASCADE:
    /does not exist on type 'never'|is not assignable to type 'never'/,
  PRIMITIVE_PROPERTY_ACCESS:
    /does not exist on type '(?:string|number|boolean|undefined|null|void)(?:\s*\|\s*(?:string|number|boolean|undefined|null|void))*'/,
  CSS_PROPERTIES_COMPAT: /CSSProperties/,
  OBJECT_IS_UNKNOWN: /Object is of type 'unknown'/,
} as const;

/**
 * The format of the code block being validated. Polaris components are web
 * components, so the same element is valid in two syntaxes:
 *  - "tsx"/"jsx": React/Preact JSX, validated against the JSX prop interfaces
 *    (number/boolean props, camelCase handlers). This is the default and
 *    unchanged historical behavior.
 *  - "html": raw HTML, where every attribute value is a string and native
 *    global attributes (class, style, onclick, ...) are valid.
 */
export type ValidationLanguage = "html" | "tsx" | "jsx";

// Native global HTML attributes that are valid on any element but are absent
// from the Polaris web-component JSX prop interfaces. In HTML mode these must
// not be reported as unknown props. Limited to single-word global attributes
// from the HTML/ARIA standards; hyphenated globals (`aria-*`, `data-*`) are
// intentionally left to checkHyphenatedAttributes, which still flags kebab
// attributes because they do not map to a camelCase JS property.
const HTML_GLOBAL_ATTRIBUTES = new Set([
  // Core globals
  "class",
  "style",
  "title",
  "id",
  "slot",
  "role",
  "hidden",
  "lang",
  "dir",
  "tabindex",
  "inert",
  "part",
  "is",
  "nonce",
  "popover",
  // Editing / interaction globals
  "contenteditable",
  "draggable",
  "spellcheck",
  "translate",
  "autocapitalize",
  "autofocus",
  "accesskey",
  "enterkeyhint",
  "inputmode",
]);

// Diagnostic target ("expected") type that we treat as string-coercible in HTML
// mode: a bare numeric/boolean primitive, optionally unioned with
// undefined/null (e.g. `number | undefined`). A literal union such as
// `'auto' | 'critical'` deliberately does NOT match, so bad enum values still
// fail.
const HTML_SUPPRESSED_TARGET =
  /^(number|boolean)(\s*\|\s*(number|boolean|undefined|null))*$/;

export function isHtmlGlobalAttribute(name: string): boolean {
  // `^on[a-z]+$` matches native lowercase handlers (onclick, onchange) but not
  // JSX camelCase handlers (onClick), so suppression is scoped to HTML syntax.
  return HTML_GLOBAL_ATTRIBUTES.has(name) || /^on[a-z]+$/.test(name);
}

/**
 * True when a TS2322 "not assignable" diagnostic is a string→number/boolean
 * coercion artifact of parsing HTML as JSX. HTML has no syntax for non-string
 * literals, so `min="0"` / `hasNextPage="true"` are valid HTML the component
 * coerces at runtime. A string→string-literal-union mismatch (`tone="bogus"`)
 * is a real error even in HTML and is NOT suppressed.
 */
export function isHtmlStringCoercion(message: string): boolean {
  const match = message.match(PATTERNS.TYPE_NOT_ASSIGNABLE);
  if (!match) return false;
  const actual = match[1];
  const expected = match[2];
  if (actual !== "string") return false;
  return HTML_SUPPRESSED_TARGET.test(expected.trim());
}

export interface ComponentValidation {
  componentName: string;
  valid: boolean;
  errors: ComponentValidationError[];
  skipped?: boolean;
}

export function isStandardHTMLElement(tagName: string): boolean {
  // Case-sensitive: HTML elements are lowercase, React components are PascalCase
  // e.g., <script> matches, <Script> does not
  return (htmlTags as string[]).includes(tagName);
}

export function isStandardSVGElement(tagName: string): boolean {
  return (svgTagNames as string[]).includes(tagName);
}

function extractJSXElements(sourceFile: ts.SourceFile) {
  const elements: Array<{
    tagName: string;
    node: ts.Node;
    start: number;
    end: number;
  }> = [];

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const start = node.getStart(sourceFile);
      const end = node.getEnd();
      elements.push({ tagName, node, start, end });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return elements;
}

function createSkippedValidation(componentName: string): ComponentValidation {
  return {
    componentName,
    valid: true,
    errors: [],
    skipped: true,
  };
}

function createDisallowedElementValidation(
  componentName: string,
  elementType: "HTML" | "SVG" | "custom",
): ComponentValidation {
  const message =
    elementType === "custom"
      ? `Custom component '${componentName}' is not allowed. UI extensions must only use Shopify Polaris web components. If this is a wrapper component, make sure to import it.`
      : `${elementType} element '${componentName}' is not allowed. UI extensions must only use Shopify Polaris web components.`;

  return {
    componentName,
    valid: false,
    errors: [
      {
        property: "element",
        message,
      },
    ],
  };
}

function sanitizeComponentName(componentName: string): string {
  // remove special characters <Analytics.CartView> -> <AnalyticsCartView>
  return componentName.replace(/\./g, "");
}

/**
 * Handles non-Shopify components (HTML, SVG, and custom components).
 * Returns a ComponentValidation if the component should be skipped/handled,
 * or null if it should continue to be processed as a Shopify component.
 */
function handleNonShopifyComponent(
  componentName: string,
  shopifyWebComponents: Set<string>,
  userImportedComponents: Set<string>,
  locallyDefinedComponents: Set<string>,
  enforceShopifyOnlyComponents: boolean,
): ComponentValidation | null {
  const sanitizedComponentName = sanitizeComponentName(componentName);
  // Handle standard HTML elements
  if (isStandardHTMLElement(sanitizedComponentName)) {
    if (enforceShopifyOnlyComponents) {
      return createDisallowedElementValidation(componentName, "HTML");
    }
    return createSkippedValidation(componentName);
  }

  // Handle standard SVG elements
  if (isStandardSVGElement(sanitizedComponentName)) {
    if (enforceShopifyOnlyComponents) {
      return createDisallowedElementValidation(componentName, "SVG");
    }
    return createSkippedValidation(componentName);
  }

  // Handle non-Shopify components
  if (!shopifyWebComponents.has(sanitizedComponentName)) {
    if (enforceShopifyOnlyComponents) {
      // In strict mode, check if it's a user-imported component (wrapper)
      if (userImportedComponents.has(sanitizedComponentName)) {
        // User-imported components are allowed - assumed to be wrappers
        return createSkippedValidation(componentName);
      }
      // Check if it's a locally-defined component (wrapper)
      if (locallyDefinedComponents.has(sanitizedComponentName)) {
        // Locally-defined components are allowed - assumed to be wrappers
        return createSkippedValidation(componentName);
      }
      // Non-imported custom components are not allowed
      return createDisallowedElementValidation(componentName, "custom");
    }
    return createSkippedValidation(componentName);
  }

  // This is a Shopify component - continue processing
  return null;
}

/**
 * Shopify packages are validated separately, so we only track user-defined imports.
 */
function isUserDefinedImport(modulePath: string): boolean {
  return !modulePath.startsWith("@shopify/");
}

/**
 * Handles: import MyComponent from './MyComponent'
 */
function collectDefaultImportName(
  importClause: ts.ImportClause,
  into: Set<string>,
): void {
  if (importClause.name) {
    into.add(importClause.name.text);
  }
}

/**
 * Handles: import { Component1, Component2 } from './components'
 */
function collectNamedImportNames(
  importClause: ts.ImportClause,
  into: Set<string>,
): void {
  const { namedBindings } = importClause;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      into.add(element.name.text);
    }
  }
}

/**
 * Collects all imported names (default and named) from an import clause.
 */
function collectImportedNames(
  importClause: ts.ImportClause,
  into: Set<string>,
): void {
  collectDefaultImportName(importClause, into);
  collectNamedImportNames(importClause, into);
}

/**
 * Extracts the module path from an import declaration if it's a string literal.
 */
function getModulePath(node: ts.ImportDeclaration): string | null {
  const { moduleSpecifier } = node;
  if (ts.isStringLiteral(moduleSpecifier)) {
    return moduleSpecifier.text;
  }
  return null;
}

/**
 * Extracts user-imported component names from the code.
 * These are components imported from non-Shopify packages that we assume
 * are wrapper components containing only Shopify components.
 */
export function extractUserImportedComponents(
  sourceFile: ts.SourceFile,
): Set<string> {
  const userImportedComponents = new Set<string>();

  function visitNode(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      processImportDeclaration(node, userImportedComponents);
    }
    ts.forEachChild(node, visitNode);
  }

  ts.forEachChild(sourceFile, visitNode);
  return userImportedComponents;
}

function processImportDeclaration(
  node: ts.ImportDeclaration,
  into: Set<string>,
): void {
  const modulePath = getModulePath(node);
  if (!modulePath) {
    return;
  }

  if (!isUserDefinedImport(modulePath)) {
    return;
  }

  const { importClause } = node;
  if (importClause) {
    collectImportedNames(importClause, into);
  }
}

/**
 * Checks if a name follows PascalCase convention (React/Preact component naming).
 * PascalCase names start with an uppercase letter.
 */
function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name);
}

/**
 * Extracts locally-defined component names from the code.
 * These are components defined in the same file (function declarations,
 * arrow functions, or class declarations) that we assume are wrapper
 * components containing only Shopify components.
 */
export function extractLocallyDefinedComponents(
  sourceFile: ts.SourceFile,
): Set<string> {
  const locallyDefinedComponents = new Set<string>();

  function visitNode(node: ts.Node): void {
    // Handle: function Extension() { ... }
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      if (isPascalCase(name)) {
        locallyDefinedComponents.add(name);
      }
    }

    // Handle: const Extension = () => { ... } or const Extension = function() { ... }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          const name = declaration.name.text;
          if (isPascalCase(name)) {
            locallyDefinedComponents.add(name);
          }
        }
      }
    }

    // Handle: class Extension extends Component { ... }
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text;
      if (isPascalCase(name)) {
        locallyDefinedComponents.add(name);
      }
    }

    ts.forEachChild(node, visitNode);
  }

  ts.forEachChild(sourceFile, visitNode);
  return locallyDefinedComponents;
}

function hyphenatedToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function checkHyphenatedAttributes(node: ts.Node): ComponentValidationError[] {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
    return [];
  }
  const errors: ComponentValidationError[] = [];
  for (const attr of node.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    const attrName = ts.isIdentifier(attr.name)
      ? attr.name.text
      : attr.name.getText();
    if (!attrName.includes("-")) continue;
    // aria-* and data-* are standard HTML attributes valid on any element
    if (attrName.startsWith("aria-") || attrName.startsWith("data-")) continue;
    const camelCase = hyphenatedToCamelCase(attrName);
    errors.push({
      property: attrName,
      message: `Property '${attrName}' uses a hyphenated name which is not a valid Polaris prop. Use camelCase '${camelCase}' instead.`,
    });
  }
  return errors;
}

export interface ExtractComponentValidationsOptions {
  /**
   * When true, HTML/SVG elements and non-Shopify custom components will fail validation.
   * Used for UI extensions (Checkout, Admin, Customer Account, POS) that must only use
   * Shopify Polaris web components.
   */
  enforceShopifyOnlyComponents?: boolean;
  /**
   * Format of the code block. When "html", HTML-legal attribute syntax
   * (string-valued number/boolean props, native global attributes) is accepted
   * instead of being flagged as a JSX type error. Defaults to TSX behavior.
   */
  language?: ValidationLanguage;
}

export function extractComponentValidations(
  originalCode: string,
  diagnostics: ts.Diagnostic[],
  shopifyWebComponents: Set<string>,
  options: ExtractComponentValidationsOptions = {},
): {
  validations: ComponentValidation[];
  genericErrors: GenericError[];
} {
  const { enforceShopifyOnlyComponents = false, language } = options;
  const htmlMode = language === "html";
  const validations: ComponentValidation[] = [];
  const handledDiagnostics = new Set<ts.Diagnostic>();

  const sourceFile = ts.createSourceFile(
    "temp.tsx",
    originalCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const elements = extractJSXElements(sourceFile);

  // In strict mode, extract user-imported and locally-defined components to allow them as wrappers
  const userImportedComponents = enforceShopifyOnlyComponents
    ? extractUserImportedComponents(sourceFile)
    : new Set<string>();

  const locallyDefinedComponents = enforceShopifyOnlyComponents
    ? extractLocallyDefinedComponents(sourceFile)
    : new Set<string>();

  for (const { tagName: componentName, node, start, end } of elements) {
    const nonShopifyComponentValidationResult = handleNonShopifyComponent(
      componentName,
      shopifyWebComponents,
      userImportedComponents,
      locallyDefinedComponents,
      enforceShopifyOnlyComponents,
    );

    // If nonShopifyComponentValidationResult is not null,
    // it means the component is not a Shopify component
    if (nonShopifyComponentValidationResult) {
      validations.push(nonShopifyComponentValidationResult);
      continue;
    }

    const { errors, handledDiagnostics: componentHandledDiagnostics } =
      getComponentErrors(start, end, diagnostics, htmlMode);

    componentHandledDiagnostics.forEach((d) => handledDiagnostics.add(d));

    // TypeScript silently allows hyphenated attributes on custom elements (web components),
    // treating them like HTML data-* attributes. We must check for these explicitly.
    const hyphenatedErrors = checkHyphenatedAttributes(node);
    errors.push(...hyphenatedErrors);

    validations.push({
      componentName,
      valid: errors.length === 0,
      errors,
    });
  }

  const unhandledDiagnostics = diagnostics.filter(
    (d) => !handledDiagnostics.has(d),
  );

  const genericErrors: GenericError[] = unhandledDiagnostics
    .filter((d) => shouldIncludeDiagnostic(d, htmlMode))
    .filter(shouldIncludeGenericDiagnostic)
    .map((d) => ({
      message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      code: d.code,
      start: d.start,
      end:
        d.start !== undefined && d.length !== undefined
          ? d.start + d.length
          : undefined,
    }));

  return { validations, genericErrors };
}

function shouldIncludeDiagnostic(
  diagnostic: ts.Diagnostic,
  htmlMode = false,
): boolean {
  if (diagnostic.start === undefined || diagnostic.length === undefined) {
    return false;
  }

  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

  if (diagnostic.code === DIAGNOSTIC_CODES.NAMESPACE_USED_AS_VALUE) {
    return false;
  }

  // HTML mode: drop false positives that are legal HTML but invalid JSX.
  if (htmlMode) {
    const globalAttrMatch = message.match(PATTERNS.PROPERTY_NOT_EXIST);
    if (globalAttrMatch && isHtmlGlobalAttribute(globalAttrMatch[1])) {
      return false;
    }
    if (isHtmlStringCoercion(message)) {
      return false;
    }
  }

  if (
    message.includes("Cannot find module") &&
    !message.match(PATTERNS.SHOPIFY_MODULE)
  ) {
    return false;
  }

  if (
    message.match(PATTERNS.MODULE_NOT_FOUND) ||
    message.match(PATTERNS.USED_BEFORE_BEING_DEFINED) ||
    message.match(PATTERNS.INVALID_JSX_ELEMENT) ||
    message.match(PATTERNS.IMPLICITLY_HAS_AN_ANY_TYPE)
  ) {
    return false;
  }

  return true;
}

// Filters TS strict-mode noise from generic (non-component) diagnostics only.
// Separate from shouldIncludeDiagnostic because these patterns should NOT
// suppress component-scoped prop errors (shouldIncludeDiagnostic is also
// called from isRelevantDiagnostic for component validation).
function shouldIncludeGenericDiagnostic(diagnostic: ts.Diagnostic): boolean {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

  if (
    message.match(PATTERNS.PREACT_REACT_COMPAT) ||
    message.match(PATTERNS.NEVER_TYPE_CASCADE) ||
    message.match(PATTERNS.PRIMITIVE_PROPERTY_ACCESS) ||
    message.match(PATTERNS.CSS_PROPERTIES_COMPAT) ||
    message.match(PATTERNS.OBJECT_IS_UNKNOWN)
  ) {
    return false;
  }

  return true;
}

function isRelevantDiagnostic(
  diagnostic: ts.Diagnostic,
  componentStart: number,
  componentEnd: number,
  htmlMode = false,
): boolean {
  if (!shouldIncludeDiagnostic(diagnostic, htmlMode)) {
    return false;
  }

  // TS2304 "Cannot find name 'X'" inside a Shopify component's range is
  // almost always a snippet-incompleteness artifact (the model references
  // a handler/state identifier defined elsewhere, e.g.
  // `<s-button onClick={handleClick}>`). It does not reflect a Polaris API
  // violation. Demote to a generic error instead of attributing it to the
  // component. Generic-error reporting still surfaces it via shouldIncludeDiagnostic.
  if (diagnostic.code === DIAGNOSTIC_CODES.CANNOT_FIND_NAME) {
    return false;
  }

  const diagnosticStart = diagnostic.start!;
  const diagnosticEnd = diagnostic.start! + diagnostic.length!;

  const isInRange =
    diagnosticStart >= componentStart && diagnosticEnd <= componentEnd;

  if (!isInRange) {
    return false;
  }

  return true;
}

export function getComponentErrors(
  componentStart: number,
  componentEnd: number,
  diagnostics: ts.Diagnostic[],
  htmlMode = false,
): {
  errors: ComponentValidation["errors"];
  handledDiagnostics: ts.Diagnostic[];
} {
  const errors: ComponentValidation["errors"] = [];
  const handledDiagnostics: ts.Diagnostic[] = [];

  const relevantDiagnostics = diagnostics.filter((diagnostic) =>
    isRelevantDiagnostic(diagnostic, componentStart, componentEnd, htmlMode),
  );

  for (const diagnostic of relevantDiagnostics) {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );
    const error = parseDiagnostic(diagnostic, message);
    if (error) {
      errors.push(error);
      handledDiagnostics.push(diagnostic);
    }
  }

  return { errors, handledDiagnostics };
}

export function parseDiagnostic(
  _diagnostic: ts.Diagnostic,
  message: string,
): ComponentValidation["errors"][0] | null {
  let property = "";
  let expected: string | undefined;
  let actual: string | undefined;

  const propertyNotExistMatch = message.match(PATTERNS.PROPERTY_NOT_EXIST);
  if (propertyNotExistMatch) {
    property = propertyNotExistMatch[1];
  } else {
    const typeMatch = message.match(PATTERNS.TYPE_NOT_ASSIGNABLE);
    const propMatch = message.match(PATTERNS.PROPERTY);

    if (typeMatch) {
      actual = typeMatch[1];
      expected = typeMatch[2];
    }

    if (propMatch) {
      property = propMatch[1];
    }
  }

  return {
    property: property || "unknown",
    message,
    expected,
    actual,
  };
}

export function formatValidationResponse(
  validations: ComponentValidation[],
  genericErrors: GenericError[] = [],
): ValidationResponse {
  const errors: string[] = [];
  const validComponents: string[] = [];
  const skippedComponents: string[] = [];

  for (const validation of validations) {
    if (validation.valid) {
      if (validation.skipped) {
        skippedComponents.push(validation.componentName);
      } else {
        validComponents.push(validation.componentName);
      }
    } else {
      for (const error of validation.errors) {
        errors.push(
          `${validation.componentName} validation failed: Property '${error.property}': ${error.message}`,
        );
      }
    }
  }

  for (const error of genericErrors) {
    errors.push(error.message);
  }

  let resultDetail: string;
  let result: ValidationResult;

  if (errors.length === 0) {
    result = ValidationResult.SUCCESS;
    if (validComponents.length > 0) {
      resultDetail = `All components validated successfully by TypeScript. Found components: ${Array.from(new Set(validComponents)).join(", ")}.`;
    } else {
      resultDetail = `No components found to validate by TypeScript.`;
    }
  } else {
    result = ValidationResult.FAILED;
    resultDetail = `Validation errors:\n${errors.join("\n")}`;
  }

  if (skippedComponents.length > 0) {
    resultDetail += `\n\nTry and use component from Shopify Polaris components. Non-Shopify components (not validated):\n${skippedComponents.map((c) => `  - ${c}`).join("\n")}`;
  }

  return {
    result,
    resultDetail,
    componentValidationErrors: validations
      .filter((v) => !v.skipped && !v.valid)
      .flatMap((v) =>
        v.errors.map((e) => ({
          componentName: v.componentName,
          ...e,
        })),
      ),
    genericErrors,
    unvalidatedComponents: Array.from(new Set(skippedComponents)),
    validatedComponents: Array.from(new Set(validComponents)),
  };
}
