import {createVirtualTSEnvironment, addFileToVirtualEnv} from './virtual-ts-environment.js'
import {loadTypesIntoTSEnv, resolveJsxRuntime} from './load-types.js'
import {formatCode} from './format-code.js'
import {
  extractComponentValidations,
  formatValidationResponse,
  type ValidationLanguage,
} from './extract-component-validations.js'
import {COMPONENT_APIS, isComponentApi, type ComponentApi, type ComponentApiConfig} from './component-apis.js'
import {ValidationResponse, ValidationResult, VersionCatalog} from '../contract.js'
import type ts from 'typescript'

// The main component-code validator. Faithful port of the source
// `validation/validateComponentCodeBlock.ts`, with the TypeScript compiler,
// data directory and version catalog passed in explicitly (the CLI loads
// TypeScript lazily and reads the reference data from bundled assets at runtime).

/**
 * APIs that require strict mode: only Shopify Polaris web components are
 * allowed; HTML/SVG elements and un-imported custom components fail.
 */
const ENFORCE_SHOPIFY_ONLY_COMPONENTS_APIS: ReadonlyArray<ComponentApi> = [
  'polaris-admin-extensions',
  'polaris-checkout-extensions',
  'polaris-customer-account-extensions',
  'pos-ui',
]

/** APIs that accept raw HTML (`--language html`). */
const RAW_HTML_COMPONENT_VALIDATION_APIS: ReadonlyArray<ComponentApi> = ['polaris-app-home']

function supportsRawHtmlComponentValidation(apiName: ComponentApi): boolean {
  return RAW_HTML_COMPONENT_VALIDATION_APIS.includes(apiName)
}

export interface ValidateComponentCodeBlockInput {
  /** The lazily-loaded TypeScript compiler. */
  typescript: typeof ts
  code: string
  apiName: string
  version?: string
  extensionTarget?: string
  /** Format of the code block; defaults to TSX. */
  language?: ValidationLanguage
  /** The components data directory (contains `supported-versions-schema.json` and `types/`). */
  dataDir: string
  /** The version catalog. */
  catalog: VersionCatalog
}

/**
 * Validates a UI-framework component code block for a Shopify extension API and
 * returns a structured {@link ValidationResponse}. Never throws — any internal
 * error is captured as a FAILED response, mirroring the source contract.
 */
export function validateComponentCodeBlock(input: ValidateComponentCodeBlockInput): ValidationResponse {
  try {
    const {typescript, code, apiName, version, extensionTarget, language, dataDir, catalog} = input

    if (!apiName) {
      return {result: ValidationResult.FAILED, resultDetail: 'Validation failed: Invalid input: apiName is required'}
    }

    if (!code) {
      return {result: ValidationResult.FAILED, resultDetail: 'Validation failed: Invalid input: code is required'}
    }

    if (!isComponentApi(apiName)) {
      return {result: ValidationResult.FAILED, resultDetail: `Validation failed: Unknown API: ${apiName}`}
    }

    const apiConfig: ComponentApiConfig = COMPONENT_APIS[apiName]

    if (language === 'html' && !supportsRawHtmlComponentValidation(apiName)) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: HTML validation mode is only supported for API 'polaris-app-home'. Other UI framework APIs must use JSX/TSX code blocks.`,
      }
    }

    if (apiConfig.extensionSurfaceName && !extensionTarget) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Extension target is required for API: ${apiName}. Look up the list of available extension targets in the API documentation.`,
      }
    }

    if (!apiConfig.publicPackages || apiConfig.publicPackages.length === 0) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: No packages configured for API: ${apiName}`,
      }
    }

    const virtualEnv = createVirtualTSEnvironment(typescript, resolveJsxRuntime(apiName, code))

    const {
      missingPackages,
      searchedPaths,
      shopifyWebComponents,
      unsupportedVersion,
      invalidTarget,
      applicablePackageNames,
      hasTargetSubpath,
    } = loadTypesIntoTSEnv({
      api: apiName,
      apiConfig,
      apiVersion: version,
      virtualEnv,
      extensionTarget,
      dataDir,
      catalog,
    })

    const packageNames = applicablePackageNames
    if (unsupportedVersion) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: Version '${unsupportedVersion.requested}' is not supported for API '${apiName}'. Supported versions: ${unsupportedVersion.supported.join(', ')}`,
      }
    }
    if (invalidTarget) {
      const supportedNote = invalidTarget.supported.length
        ? `Supported extension targets for surface '${invalidTarget.surface}'${version ? ` at version '${version}'` : ''}: ${invalidTarget.supported.join(', ')}`
        : `No extension targets are bundled for surface '${invalidTarget.surface}'${version ? ` at version '${version}'` : ''}.`
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: Unknown extension target '${invalidTarget.target}' for API '${apiName}'. ${supportedNote}`,
      }
    }
    if (missingPackages.length > 0) {
      const packageList = missingPackages.map((pkg) => `  - ${pkg}`).join('\n')
      const installCmd = `npm install -D ${missingPackages.join(' ')}`
      const searchedPathsList = searchedPaths.map((searchPath) => `  - ${searchPath}`).join('\n')

      return {
        result: ValidationResult.FAILED,
        resultDetail: `Missing required dev dependencies:\n${packageList}\n\nSearched paths:\n${searchedPathsList}\n\nPlease install them using:\n${installCmd}`,
      }
    }

    const tmpFileName = `validation-${Date.now()}.tsx`

    // For versions whose bundled types don't ship per-target subpaths, drop the
    // ui-extensions packages from the synthesized import set — otherwise
    // formatCode emits `import '@shopify/ui-extensions(-react)/<target>'`, which
    // would only resolve via filesystem fall-through, making results
    // non-deterministic.
    const packagesForImports = hasTargetSubpath
      ? packageNames
      : packageNames.filter((pkg) => !pkg.includes('@shopify/ui-extensions'))
    const codeWithImports = formatCode(code, packagesForImports, hasTargetSubpath ? extensionTarget : undefined)

    addFileToVirtualEnv(virtualEnv, tmpFileName, codeWithImports)

    const diagnostics = virtualEnv.languageService.getSemanticDiagnostics(tmpFileName)

    const enforceShopifyOnlyComponents = ENFORCE_SHOPIFY_ONLY_COMPONENTS_APIS.includes(apiName)

    const {validations, genericErrors} = extractComponentValidations(
      typescript,
      codeWithImports,
      diagnostics,
      shopifyWebComponents,
      {
        enforceShopifyOnlyComponents,
        language,
      },
    )

    return formatValidationResponse(validations, genericErrors)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return {
      result: ValidationResult.FAILED,
      resultDetail: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
