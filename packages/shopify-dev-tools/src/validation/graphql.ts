import {
  buildClientSchema,
  GraphQLSchema,
  NoDeprecatedCustomRule,
  parse,
  validate,
} from "graphql";
import {
  APIVersionWithAPI,
  diskSchemaSource,
  loadAPISchemas,
} from "../schemaOperations/loadAPISchemas.js";
import { analyzeRequiredOfflineScopes } from "../schemaOperations/offlineScopes.js";
import type { SchemaSource } from "../schemaOperations/schemaSource.js";
import type { OfflineScopeData } from "../schemaOperations/types.js";
import type { ShopifyAPIs } from "../types/api-mapping.js";
import {
  GraphQLValidationResult,
  ValidationResult,
  ValidationToolResult,
} from "../types/index.js";

// Re-exported so this entry exposes the result enum without importing the
// package root (which pulls in heavier, disk-reading modules).
export { ValidationResult } from "../types/index.js";
// Re-exported so callers can type a custom `schemaSource` from this entry.
export type { SchemaSource } from "../schemaOperations/schemaSource.js";

/**
 * GraphQL operation validation, isolated from component-code validation.
 *
 * This entry deliberately does NOT import `validateComponentCodeBlock`, so it
 * pulls in neither `typescript` nor `html-tags`; its runtime closure is just
 * `graphql` plus the schema bytes. Keep it that way — importing the component
 * validator here would defeat the split.
 */

/**
 * Options for GraphQL validation that supports both legacy and new formats.
 * This interface allows callers to optionally control deprecated field behavior.
 */
export interface GraphQLValidationOptions {
  /** API version configuration (optional, uses default if not provided) */
  apiVersion?: APIVersionWithAPI;
  /** When true (default), validation fails if deprecated fields are used.
   * When false, deprecated fields trigger INFORM status instead of failure. */
  failOnDeprecated?: boolean;
  /** Where schema bytes come from. Defaults to the on-disk source. */
  schemaSource?: SchemaSource;
}

/**
 * Type guard to check if options is the legacy APIVersionWithAPI format
 */
function isAPIVersionWithAPI(
  options: APIVersionWithAPI | GraphQLValidationOptions,
): options is APIVersionWithAPI {
  return (
    options && typeof (options as APIVersionWithAPI).schemaPath === "string"
  );
}

/**
 * Internal options for performGraphQLValidation
 */
interface PerformValidationOptions {
  /** The GraphQL operation code to validate */
  graphqlCode: string;
  /** The built GraphQL schema */
  schema: GraphQLSchema;
  /** The API name (e.g., "admin") */
  api: ShopifyAPIs;
  /** The schema version */
  version: string;
  /** Pre-loaded offline scope data (null if not available) */
  offlineScopeData: OfflineScopeData;
  /** When true, deprecated fields cause FAILED. When false, they cause INFORM. */
  failOnDeprecated: boolean;
}

/**
 * Validates a GraphQL operation against the specified schema
 *
 * @param graphqlCode - The raw GraphQL operation code
 * @param api - The name of the API (e.g. 'admin' for Shopify Admin API)
 * @param options - Optional validation options. Accepts either:
 *   - APIVersionWithAPI: Legacy format for backward compatibility
 *   - GraphQLValidationOptions: New format with apiVersion and failOnDeprecated
 * @returns GraphQLValidationResult with validation status and required scopes
 */
export async function validateGraphQLOperation(
  graphqlCode: string,
  api: ShopifyAPIs,
  options?: APIVersionWithAPI | GraphQLValidationOptions,
): Promise<GraphQLValidationResult> {
  const trimmedCode = graphqlCode.trim();
  if (!trimmedCode) {
    return {
      validation: {
        result: ValidationResult.FAILED,
        resultDetail: "No GraphQL operation found in the provided code.",
      },
      scopes: [],
    };
  }

  // Extract apiVersion and failOnDeprecated from options (supports both formats)
  let apiVersion: APIVersionWithAPI | undefined;
  let failOnDeprecated = true; // Default: fail on deprecated fields
  let schemaSource: SchemaSource = diskSchemaSource;

  if (options) {
    if (isAPIVersionWithAPI(options)) {
      // Legacy format: options is directly an APIVersionWithAPI
      apiVersion = options;
    } else {
      // New format: GraphQLValidationOptions
      apiVersion = options.apiVersion;
      failOnDeprecated = options.failOnDeprecated ?? true;
      schemaSource = options.schemaSource ?? diskSchemaSource;
    }
  }

  // Catalog-driven version check: when the API has entries in the active
  // schema source's catalog and the caller asks for a version that isn't one
  // of them, fail fast with a message that lists what's actually available.
  // Read from `schemaSource` (not the package-level SUPPORTED_API_VERSIONS) so
  // the check stays consistent with `loadAPISchemas`, which also consults the
  // source catalog: an injected source may carry versions this package's
  // bundled catalog doesn't, and naming one explicitly must not be rejected.
  // Internal APIs (Bourgeois, etc.) are not in the catalog and fall through.
  if (apiVersion?.name) {
    const supported = (schemaSource.readVersionCatalog()[api] ?? []).map(
      (version) => version.name,
    );
    if (supported.length > 0 && !supported.includes(apiVersion.name)) {
      throw new Error(
        `Unsupported version "${apiVersion.name}" for API "${api}". Available versions: ${supported.join(", ")}.`,
      );
    }
  }

  let graphQLSchema: GraphQLSchema;
  let offlineScopes: OfflineScopeData;
  let schemaObj: APIVersionWithAPI;

  try {
    // Step 1: Load the schema configuration
    const schemas = loadAPISchemas([api], apiVersion, schemaSource);

    // If no schemas returned, the API doesn't exist
    if (schemas.length === 0) {
      throw new Error(`No schema configuration found for API "${api}"`);
    }

    // When no specific version was requested and multiple versions are
    // configured, validate against the one flagged latestVersion. Fall back
    // to the first entry if none is flagged.
    schemaObj = schemas.find((s) => s.latestVersion) ?? schemas[0];

    // Step 2: Load and build the actual schema
    const result = await loadAndBuildGraphQLSchema(schemaObj, schemaSource);
    graphQLSchema = result.graphQLSchema;
    offlineScopes = result.offlineScopes;
  } catch (error) {
    // Just re-throw with a cleaner message if needed
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Make the error message more user-friendly
    if (errorMessage.includes("No APIs provided")) {
      throw new Error(`API name cannot be empty`);
    }

    if (errorMessage.includes("Schema file not found")) {
      // The schema file wasn't found - this means either wrong version or wrong API
      if (apiVersion && apiVersion.name) {
        throw new Error(
          `Cannot load schema for API "${api}" version "${apiVersion.name}" - the schema file does not exist`,
        );
      }
      throw new Error(
        `Cannot load schema for API "${api}" - the schema file does not exist`,
      );
    }

    // For any other error, just re-throw as-is
    throw error;
  }

  return performGraphQLValidation({
    graphqlCode: trimmedCode,
    schema: graphQLSchema,
    api,
    version: schemaObj.name,
    offlineScopeData: offlineScopes,
    failOnDeprecated,
  });
}

/**
 * Check if any validation response in a set has failed
 */
export function hasFailedValidation(responses: ValidationToolResult): boolean {
  return responses.some(
    (response) => response.result === ValidationResult.FAILED,
  );
}

async function loadAndBuildGraphQLSchema(
  apiVersion: APIVersionWithAPI | undefined,
  source: SchemaSource,
): Promise<{
  graphQLSchema: GraphQLSchema;
  offlineScopes: OfflineScopeData;
}> {
  if (!apiVersion || Object.keys(apiVersion).length === 0) {
    throw new Error("No API version provided");
  }

  const schemaContent = await source.readSchemaContent(apiVersion);
  const schemaJson = JSON.parse(schemaContent);
  const schemaData = schemaJson.data;

  // Fix empty INPUT_OBJECT types (workaround for Shopify Function schema bug)
  // Some function schemas have DeprecatedOperation with zero fields which violates GraphQL spec
  if (
    apiVersion.api.startsWith("functions_") &&
    schemaData.__schema &&
    schemaData.__schema.types
  ) {
    // First, identify empty INPUT_OBJECT types
    const emptyInputTypes = new Set<string>();
    for (const type of schemaData.__schema.types) {
      if (
        type.kind === "INPUT_OBJECT" &&
        type.inputFields &&
        type.inputFields.length === 0
      ) {
        emptyInputTypes.add(type.name);
      }
    }

    // If we have empty input types, we need to patch them
    if (emptyInputTypes.size > 0) {
      for (const type of schemaData.__schema.types) {
        // Patch the empty input types by adding a dummy field
        if (emptyInputTypes.has(type.name)) {
          type.inputFields = [
            {
              name: "_placeholder",
              description:
                "Placeholder field to satisfy GraphQL spec requirement for non-empty input objects",
              type: {
                kind: "SCALAR",
                name: "String",
                ofType: null,
              },
              defaultValue: null,
              isDeprecated: false,
              deprecationReason: null,
            },
          ];
        }
      }
    }
  }

  return {
    graphQLSchema: buildClientSchema(schemaData),
    offlineScopes: (schemaJson.offline_scopes as OfflineScopeData) || {
      items: [],
    },
  };
}

function parseGraphQLDocument(
  operation: string,
): { success: true; document: any } | { success: false; error: string } {
  try {
    const document = parse(operation);
    return { success: true, document };
  } catch (parseError) {
    return {
      success: false,
      error:
        parseError instanceof Error ? parseError.message : String(parseError),
    };
  }
}

function validateGraphQLAgainstSchema(schema: any, document: any): string[] {
  const validationErrors = validate(schema, document);
  return validationErrors.map((e) => e.message);
}

function getOperationType(document: any): string {
  if (document.definitions.length > 0) {
    const operationDefinition = document.definitions[0];
    if (operationDefinition.kind === "OperationDefinition") {
      return operationDefinition.operation;
    }
  }
  return "operation";
}

async function performGraphQLValidation(
  options: PerformValidationOptions,
): Promise<GraphQLValidationResult> {
  const { graphqlCode, schema, api, offlineScopeData, failOnDeprecated } =
    options;
  const operation = graphqlCode.trim();

  const parseResult = parseGraphQLDocument(operation);
  if (parseResult.success === false) {
    return {
      validation: {
        result: ValidationResult.FAILED,
        resultDetail: `GraphQL syntax error: ${parseResult.error}`,
      },
      scopes: [],
    };
  }

  const validationErrors = validateGraphQLAgainstSchema(
    schema,
    parseResult.document,
  );
  if (validationErrors.length > 0) {
    return {
      validation: {
        result: ValidationResult.FAILED,
        resultDetail: `GraphQL validation errors: ${validationErrors.join("; ")}`,
      },
      scopes: [],
    };
  }

  // Check for deprecated field usage using graphql-js NoDeprecatedCustomRule
  const deprecatedFieldErrors = validate(schema, parseResult.document, [
    NoDeprecatedCustomRule,
  ]);

  // Analyze required offline scopes (but don't fail validation if this fails)
  let offlineScopes: string[] = [];
  try {
    offlineScopes = await analyzeRequiredOfflineScopes(
      parseResult.document,
      offlineScopeData,
      api,
    );
  } catch (error) {
    // noop
  }

  const operationType = getOperationType(parseResult.document);

  // Handle deprecated fields based on failOnDeprecated flag
  if (deprecatedFieldErrors.length > 0) {
    const deprecatedMessages = deprecatedFieldErrors
      .map((e) => e.message)
      .join("; ");

    if (failOnDeprecated) {
      // Default behavior: fail on deprecated fields
      return {
        validation: {
          result: ValidationResult.FAILED,
          resultDetail: `Deprecated fields used: ${deprecatedMessages}`,
        },
        scopes: offlineScopes,
      };
    } else {
      // User opted in to allow deprecated fields: return INFORM (passes but with info)
      return {
        validation: {
          result: ValidationResult.INFORM,
          resultDetail: `Successfully validated GraphQL ${operationType} against schema. Note: ${deprecatedMessages}`,
        },
        scopes: offlineScopes,
      };
    }
  }

  return {
    validation: {
      result: ValidationResult.SUCCESS,
      resultDetail: `Successfully validated GraphQL ${operationType} against schema.`,
    },
    scopes: offlineScopes,
  };
}
