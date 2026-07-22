/**
 * Functional import-aware TypeScript validator
 * Only validates components that are explicitly imported from Shopify packages
 */

import { SHOPIFY_APIS } from "../config/api-mappings";
import { ValidationResponse, ValidationResult } from "../types/index.js";

import { formatCode } from "./formatCode";
import {
  addFileToVirtualEnv,
  createVirtualTSEnvironment,
} from "./createVirtualTSEnvironment";
import {
  extractComponentValidations,
  formatValidationResponse,
  ValidationLanguage,
} from "./extractComponentValidations";
import { loadTypesIntoTSEnv, resolveJsxRuntime } from "./loadTypesIntoTSEnv";

type APINameValues = keyof typeof SHOPIFY_APIS;

/**
 * APIs that require strict mode validation.
 * These UI extension APIs only support Shopify Polaris web components
 * and do not allow HTML/SVG elements or custom components.
 */
const ENFORCE_SHOPIFY_ONLY_COMPONENTS_APIS: readonly APINameValues[] = [
  "polaris-admin-extensions",
  "polaris-checkout-extensions",
  "polaris-customer-account-extensions",
  "pos-ui",
] as const;

const RAW_HTML_COMPONENT_VALIDATION_APIS: readonly APINameValues[] = [
  "polaris-app-home",
] as const;

function supportsRawHtmlComponentValidation(apiName: APINameValues): boolean {
  return RAW_HTML_COMPONENT_VALIDATION_APIS.includes(apiName);
}

interface ValidateComponentCodeBlockInput {
  code: string;
  apiName: APINameValues;
  version?: string;
  extensionTarget?: string;
  /**
   * Format of the code block. When "html", HTML-legal attribute syntax is
   * accepted instead of being flagged as a JSX type error. Defaults to TSX.
   */
  language?: ValidationLanguage;
}

/**
 * Main validation function
 */
export async function validateComponentCodeBlock(
  input: ValidateComponentCodeBlockInput,
): Promise<ValidationResponse> {
  try {
    const { code, apiName, version, extensionTarget, language } = input;

    if (!apiName) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: "Validation failed: Invalid input: apiName is required",
      };
    }

    if (!code) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: "Validation failed: Invalid input: code is required",
      };
    }

    const apiEntry = SHOPIFY_APIS[apiName];
    if (!apiEntry) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: Unknown API: ${apiName}`,
      };
    }

    if (language === "html" && !supportsRawHtmlComponentValidation(apiName)) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: HTML validation mode is only supported for API 'polaris-app-home'. Other UI framework APIs must use JSX/TSX code blocks.`,
      };
    }

    if (apiEntry.extensionSurfaceName && !extensionTarget) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Extension target is required for API: ${apiName}. Look up the list of available extension targets in the API documentation.`,
      };
    }

    if (!apiEntry.publicPackages || apiEntry.publicPackages.length === 0) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: No packages configured for API: ${apiName}`,
      };
    }

    const virtualEnv = createVirtualTSEnvironment(
      apiName,
      resolveJsxRuntime(apiName, code),
    );

    const {
      missingPackages,
      searchedPaths,
      shopifyWebComponents,
      unsupportedVersion,
      invalidTarget,
      applicablePackageNames,
      hasTargetSubpath,
    } = await loadTypesIntoTSEnv(apiName, version, virtualEnv, extensionTarget);
    // Use the version-resolved package names from the loader rather than the
    // raw `apiEntry.publicPackages`. Tagged entries with a `versions`
    // constraint (e.g. React bindings, valid only for 2025-07) get dropped
    // on web-component-era versions — without this, formatCode would inject
    // an import for a package whose surface subtree wasn't loaded.
    const packageNames = applicablePackageNames;
    if (unsupportedVersion) {
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: Version '${unsupportedVersion.requested}' is not supported for API '${apiName}'. Supported versions: ${unsupportedVersion.supported.join(", ")}`,
      };
    }
    if (invalidTarget) {
      // Modern @shopify/ui-extensions versions ship a `targets/` subtree —
      // the requested target isn't one of them. Fail fast rather than letting
      // the loader's whole-surface fallback silently accept the typo.
      const supportedNote = invalidTarget.supported.length
        ? `Supported extension targets for surface '${invalidTarget.surface}'${version ? ` at version '${version}'` : ""}: ${invalidTarget.supported.join(", ")}`
        : `No extension targets are bundled for surface '${invalidTarget.surface}'${version ? ` at version '${version}'` : ""}.`;
      return {
        result: ValidationResult.FAILED,
        resultDetail: `Validation failed: Unknown extension target '${invalidTarget.target}' for API '${apiName}'. ${supportedNote}`,
      };
    }
    if (missingPackages.length > 0) {
      const packageList = missingPackages.map((pkg) => `  - ${pkg}`).join("\n");
      const installCmd = `npm install -D ${missingPackages.join(" ")}`;
      const searchedPathsList = searchedPaths.map((p) => `  - ${p}`).join("\n");

      return {
        result: ValidationResult.FAILED,
        resultDetail: `Missing required dev dependencies:\n${packageList}\n\nSearched paths:\n${searchedPathsList}\n\nPlease install them using:\n${installCmd}`,
      };
    }

    const tmpFileName = `validation-${Date.now()}.tsx`;

    // For versions whose bundled types don't ship per-target subpaths (e.g.
    // React-based admin 2025-07, where the package only exports `/admin`,
    // `/checkout`, etc.), drop the ui-extensions packages from the synthesized
    // import set. Otherwise formatCode would emit
    // `import '@shopify/ui-extensions(-react)/<target>'`, which only resolves
    // by falling through to whatever's installed on the host — making results
    // non-deterministic across machines. The user's own
    // `@shopify/ui-extensions-react/<surface>` import in the snippet already
    // activates the surface barrel loaded into the virtual env, which is what
    // we want to validate against.
    const packagesForImports = hasTargetSubpath
      ? packageNames
      : packageNames.filter((p) => !p.includes("@shopify/ui-extensions"));
    const codeWithImports = formatCode(
      code,
      packagesForImports,
      hasTargetSubpath ? extensionTarget : undefined,
    );

    addFileToVirtualEnv(virtualEnv, tmpFileName, codeWithImports);

    const diagnostics =
      virtualEnv.languageService.getSemanticDiagnostics(tmpFileName);

    // Enable strict mode for UI extension APIs that only support Shopify Polaris web components
    const enforceShopifyOnlyComponents =
      ENFORCE_SHOPIFY_ONLY_COMPONENTS_APIS.includes(apiName);

    const { validations, genericErrors } = extractComponentValidations(
      codeWithImports,
      diagnostics,
      shopifyWebComponents,
      { enforceShopifyOnlyComponents, language },
    );

    return formatValidationResponse(validations, genericErrors);
  } catch (error) {
    return {
      result: ValidationResult.FAILED,
      resultDetail: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
