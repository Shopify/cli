import { getScopes, loadAPISchema } from "../schemaOperations/index.js";
import { loadSchemaContent } from "../schemaOperations/loadSchemaContent.js";
import type { OfflineScopeData } from "../schemaOperations/types.js";
import type { ShopifyAPIs } from "../types/api-mapping.js";
import type { APIVersion } from "../types/index.js";

// Maximum number of fields to extract from an object
const MAX_FIELDS_TO_SHOW = 50;

// ============================================================================
// Smart Truncation System
// ============================================================================

/**
 * Smart Description Truncation System
 *
 * Core Principles:
 * 1. No truncation if under limit - If total output is under 5000 tokens, show everything in full
 * 2. Proportional truncation - Longer descriptions contribute more to reduction
 * 3. Minimum preservation - Always show at least 80 chars of each description
 * 4. Progressive reduction - Trim the longest descriptions first
 *
 * Algorithm:
 * - Calculate total tokens (approximate: 1 token ≈ 4 chars)
 * - If under limit, no truncation needed
 * - Otherwise, apply tiered truncation based on description length:
 *   * Very long (>500 chars): reduce to 30% of original
 *   * Long (300-500 chars): reduce to 50% of original
 *   * Medium (150-300 chars): reduce to 70% of original
 *   * Short (<150 chars): keep intact initially
 * - Fine-tune by progressively trimming longest descriptions until within limit
 */

const TOKEN_LIMIT = 5000;
const MIN_DESCRIPTION_LENGTH = 80;
const CHARS_PER_TOKEN = 4; // Rough approximation for token counting

interface DescriptionEntry {
  original: string;
  truncated: string;
  maxLength: number;
}

class SmartTruncationManager {
  private descriptions: Map<string, DescriptionEntry> = new Map();
  private structuralTokens: number = 0;

  /**
   * Add structural tokens (field names, types, formatting)
   */
  addStructuralTokens(chars: number): void {
    this.structuralTokens += Math.ceil(chars / CHARS_PER_TOKEN);
  }

  /**
   * Register a description for potential truncation
   */
  registerDescription(id: string, description: string): string {
    if (!description) return "";

    // Clean up the description
    const cleaned = description.replace(/\n/g, " ").trim();

    this.descriptions.set(id, {
      original: cleaned,
      truncated: cleaned,
      maxLength: cleaned.length,
    });

    return id; // Return ID as placeholder
  }

  /**
   * Apply smart truncation based on token limits
   */
  applySmartTruncation(): void {
    // Calculate total tokens with full descriptions
    const descriptionTokens = Array.from(this.descriptions.values()).reduce(
      (sum, desc) => sum + Math.ceil(desc.original.length / CHARS_PER_TOKEN),
      0,
    );

    const totalTokens = this.structuralTokens + descriptionTokens;

    // No truncation needed if under limit
    if (totalTokens <= TOKEN_LIMIT) {
      return;
    }

    // Calculate how many tokens we need to save
    const tokensToSave = totalTokens - TOKEN_LIMIT;
    const charsToSave = tokensToSave * CHARS_PER_TOKEN;

    // Get descriptions sorted by length (longest first)
    const sortedDescs = Array.from(this.descriptions.entries()).sort(
      (a, b) => b[1].original.length - a[1].original.length,
    );

    // Apply tiered truncation based on length
    let charsSaved = 0;

    for (const [_id, desc] of sortedDescs) {
      if (charsSaved >= charsToSave) break;

      const originalLength = desc.original.length;
      let targetLength = originalLength;

      // Determine truncation tier based on original length
      if (originalLength > 500) {
        targetLength = Math.max(
          MIN_DESCRIPTION_LENGTH,
          Math.floor(originalLength * 0.3),
        );
      } else if (originalLength > 300) {
        targetLength = Math.max(
          MIN_DESCRIPTION_LENGTH,
          Math.floor(originalLength * 0.5),
        );
      } else if (originalLength > 150) {
        targetLength = Math.max(
          MIN_DESCRIPTION_LENGTH,
          Math.floor(originalLength * 0.7),
        );
      }
      // Short descriptions (<150) remain intact initially

      if (targetLength < originalLength) {
        desc.maxLength = targetLength;
        charsSaved += originalLength - targetLength;
      }
    }

    // Fine-tune if still over limit by progressively trimming the longest descriptions.
    // Note: If all descriptions are already at MIN_DESCRIPTION_LENGTH, we accept going
    // over TOKEN_LIMIT rather than making descriptions too short to be useful.
    while (charsSaved < charsToSave) {
      const sortedByMaxLength = Array.from(this.descriptions.values())
        .filter((desc) => desc.maxLength > MIN_DESCRIPTION_LENGTH)
        .sort((a, b) => b.maxLength - a.maxLength);

      if (sortedByMaxLength.length === 0) break;

      const desc = sortedByMaxLength[0];
      const reduction = Math.floor(desc.maxLength * 0.1); // Trim by 10%
      const newLength = Math.max(
        MIN_DESCRIPTION_LENGTH,
        desc.maxLength - reduction,
      );

      charsSaved += desc.maxLength - newLength;
      desc.maxLength = newLength;
    }

    // Apply the calculated truncations
    for (const [_id, desc] of this.descriptions.entries()) {
      if (desc.maxLength < desc.original.length) {
        desc.truncated = desc.original.substring(0, desc.maxLength) + "...";
      }
    }
  }

  /**
   * Get the final truncated description
   */
  getDescription(id: string): string {
    const entry = this.descriptions.get(id);
    return entry ? entry.truncated : "";
  }

  /**
   * Check if any truncation occurred
   */
  hadTruncation(): boolean {
    return Array.from(this.descriptions.values()).some(
      (desc) => desc.truncated !== desc.original,
    );
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Schema options for introspection
 */

export interface IntrospectionOptions {
  /** Optional schema configuration. If provided, must contain both version and schemas */
  schemaOptions?: APIVersion;
  /** Filter for what types of schema elements to include in results */
  filter?: Array<"all" | "types" | "queries" | "mutations">;
}

export interface GraphQLSchemaItem {
  /** The name of the item (type, query, mutation) */
  name: string;
  /** The description of the item */
  description?: string;
  /** The formatted details of the item */
  details: string;
  /** Required offline scopes for this item */
  scopes: string[];
}

export interface IntrospectionResult {
  /** Matching GraphQL types found in the schema */
  types: GraphQLSchemaItem[];
  /** Whether types were truncated due to result limits */
  typesWereTruncated: boolean;

  /** Matching GraphQL queries found in the schema */
  queries: GraphQLSchemaItem[];
  /** Whether queries were truncated due to result limits */
  queriesWereTruncated: boolean;

  /** Matching GraphQL mutations found in the schema */
  mutations: GraphQLSchemaItem[];
  /** Whether mutations were truncated due to result limits */
  mutationsWereTruncated: boolean;
}

interface FilteredItems<T = any> {
  wasTruncated: boolean;
  items: T[];
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Formats a GraphQL type recursively
 */
const formatType = (type: any): string => {
  if (!type) return "null";

  if (type.kind === "NON_NULL") {
    return `${formatType(type.ofType)}!`;
  } else if (type.kind === "LIST") {
    return `[${formatType(type.ofType)}]`;
  } else {
    return type.name;
  }
};

/**
 * Formats a GraphQL argument
 */
const formatArg = (arg: any): string => {
  return `${arg.name}: ${formatType(arg.type)}${
    arg.defaultValue !== null ? ` = ${arg.defaultValue}` : ""
  }`;
};

/**
 * Filters out deprecated arguments from a field
 */
const filterDeprecatedArgs = (args: any[]): any[] => {
  if (!args) return [];
  return args.filter((arg: any) => !arg.isDeprecated && !arg.deprecationReason);
};

/**
 * Filters out deprecated fields from an array
 */
const filterDeprecatedFields = (fields: any[]): any[] => {
  if (!fields) return [];
  return fields.filter(
    (field: any) => !field.isDeprecated && !field.deprecationReason,
  );
};

/**
 * Formats a GraphQL field with its arguments and type
 */
const formatField = (
  field: any,
  truncationManager?: SmartTruncationManager,
  idPrefix: string = "",
): string => {
  let result = `    ${field.name}`; // Increased indent for field name

  // Add arguments if present (filtering out deprecated ones)
  const validArgs = filterDeprecatedArgs(field.args);
  if (validArgs && validArgs.length > 0) {
    result += `(${validArgs.map(formatArg).join(", ")})`;
  }

  result += `: ${formatType(field.type)}`;

  if (field.description) {
    if (truncationManager) {
      // Register description and use placeholder
      const descId = `${idPrefix}_field_${field.name}`;
      truncationManager.registerDescription(descId, field.description);
      result += `\n      # {{${descId}}}`; // Increased indent for description
    } else {
      // Fallback to old behavior if no manager provided
      const desc = field.description.replace(/\n/g, " ").trim();
      result += `\n      # ${desc}`; // Increased indent for description
    }
  }

  return result;
};

/**
 * Formats a GraphQL schema type (Object, Interface, Union, etc.)
 */
const formatSchemaType = (
  item: any,
  truncationManager?: SmartTruncationManager,
): string => {
  let result = `${item.kind} ${item.name}`;

  if (item.description) {
    if (truncationManager) {
      const descId = `type_${item.name}_desc`;
      truncationManager.registerDescription(descId, item.description);
      result += `\n  Description: {{${descId}}}`;
    } else {
      const desc = item.description.replace(/\n/g, " ");
      result += `\n  Description: ${desc}`;
    }
  }

  // Add interfaces if present
  if (item.interfaces && item.interfaces.length > 0) {
    result += `\n  Implements: ${item.interfaces
      .map((i: any) => i.name)
      .join(", ")}`;
  }

  // For INPUT_OBJECT types, use inputFields instead of fields
  if (
    item.kind === "INPUT_OBJECT" &&
    item.inputFields &&
    item.inputFields.length > 0
  ) {
    // Filter out deprecated input fields
    const validInputFields = filterDeprecatedFields(item.inputFields);
    if (validInputFields.length > 0) {
      result += "\n\n  Input Fields:";
      // Extract at most MAX_FIELDS_TO_SHOW fields
      const fieldsToShow = validInputFields.slice(0, MAX_FIELDS_TO_SHOW);
      for (const field of fieldsToShow) {
        result += `\n\n${formatField(field, truncationManager, `type_${item.name}`)}`;
      }
      if (validInputFields.length > MAX_FIELDS_TO_SHOW) {
        result += `\n\n    ... and ${
          validInputFields.length - MAX_FIELDS_TO_SHOW
        } more input fields`;
      }
    }
  }
  // For regular object types, use fields
  else if (item.fields && item.fields.length > 0) {
    // Filter out deprecated fields
    const validFields = filterDeprecatedFields(item.fields);
    if (validFields.length > 0) {
      result += "\n\n  Fields:";
      // Extract at most MAX_FIELDS_TO_SHOW fields
      const fieldsToShow = validFields.slice(0, MAX_FIELDS_TO_SHOW);
      for (const field of fieldsToShow) {
        result += `\n\n${formatField(field, truncationManager, `type_${item.name}`)}`;
      }
      if (validFields.length > MAX_FIELDS_TO_SHOW) {
        result += `\n\n    ... and ${
          validFields.length - MAX_FIELDS_TO_SHOW
        } more fields`;
      }
    }
  }

  return result;
};

/**
 * Formats a GraphQL operation (Query or Mutation)
 */
const formatGraphqlOperation = (
  query: any,
  typeName: string,
  offlineScopes: OfflineScopeData,
  truncationManager?: SmartTruncationManager,
): string => {
  let result = `${query.name}`;

  if (query.description) {
    if (truncationManager) {
      const descId = `op_${typeName}_${query.name}_desc`;
      truncationManager.registerDescription(descId, query.description);
      result += `\n  Description: {{${descId}}}`;
    } else {
      const desc = query.description.replace(/\n/g, " ");
      result += `\n  Description: ${desc}`;
    }
  }

  // Add arguments if present (filtering out deprecated ones)
  const validArgs = filterDeprecatedArgs(query.args);
  if (validArgs && validArgs.length > 0) {
    result += "\n  Arguments:";
    for (const arg of validArgs) {
      result += `\n    ${formatArg(arg)}`;
    }
  }

  // Add return type
  result += `\n  Returns: ${formatType(query.type)}`;

  // Add scope information
  // Check for field-level scopes first
  let scopes = getScopes(offlineScopes, typeName, query.name);

  // If no field-level scopes, check the return type
  if (!scopes || scopes.length === 0) {
    // Get the base type name (remove ! and [] modifiers)
    let returnTypeName = formatType(query.type);
    returnTypeName = returnTypeName.replace(/[\[\]!]/g, "").trim();

    // Try the return type directly
    scopes = getScopes(offlineScopes, returnTypeName);

    // If the return type is a Connection type, try the base type
    // e.g., ProductConnection -> Product
    if (
      (!scopes || scopes.length === 0) &&
      returnTypeName.endsWith("Connection")
    ) {
      const baseTypeName = returnTypeName.replace(/Connection$/, "");
      scopes = getScopes(offlineScopes, baseTypeName);
    }
  }

  return result;
};

// ============================================================================
// Filtering and Sorting
// ============================================================================

/**
 * Filters, sorts, and truncates schema items based on search term
 */
const filterAndSortItems = (
  items: any[],
  searchTerm: string,
  maxItems: number,
): FilteredItems => {
  // Filter items based on search term
  const filtered = items.filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm),
  );

  // Sort filtered items by name length (shorter names first)
  filtered.sort((a: any, b: any) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.length - b.name.length;
  });

  // Return truncation info and limited items
  return {
    wasTruncated: filtered.length > maxItems,
    items: filtered.slice(0, maxItems),
  };
};

// ============================================================================
// Main Introspection Function
// ============================================================================

/**
 * Introspects a GraphQL schema and returns formatted results
 * @param query Search term to filter schema elements
 * @param api The API name (e.g., "admin")
 * @param options Optional introspection options
 * @returns IntrospectionResult with formatted schema information
 */
export async function introspectGraphqlSchema(
  query: string,
  api: ShopifyAPIs,
  options: IntrospectionOptions = {},
): Promise<IntrospectionResult> {
  const { schemaOptions, filter = ["all"] } = options;

  // Create truncation manager for smart description handling
  const truncationManager = new SmartTruncationManager();

  // Get the schema based on the API and optional schema configuration.
  // If no schemaOptions are provided, this uses the latest stable release schema.
  const schema = loadAPISchema(api, schemaOptions);

  // Load the schema content from the bundled file
  const schemaContent = await loadSchemaContent(schema);

  // Parse the schema content
  const schemaJson = JSON.parse(schemaContent);

  // Extract offline scope data - not all APIs have this
  const offlineScopes: OfflineScopeData =
    (schemaJson.offline_scopes as OfflineScopeData) || { items: [] };

  // Get the actual query and mutation type names from the schema
  // Note: Different APIs use different names (e.g., Query vs QueryRoot)
  const queryTypeName = schemaJson.data.__schema.queryType?.name || "QueryRoot";
  const mutationTypeName =
    schemaJson.data.__schema.mutationType?.name || "Mutation";

  // If a query is provided, filter the schema
  let resultSchema = schemaJson;
  let wasTruncated = false;
  let queriesWereTruncated = false;
  let mutationsWereTruncated = false;

  if (query && query.trim()) {
    // Normalize search term: remove trailing 's' and remove all spaces
    let normalizedQuery = query.trim();
    if (normalizedQuery.endsWith("s")) {
      normalizedQuery = normalizedQuery.slice(0, -1);
    }
    normalizedQuery = normalizedQuery.replace(/\s+/g, "");

    const searchTerm = normalizedQuery.toLowerCase();

    if (schemaJson?.data?.__schema?.types) {
      const MAX_RESULTS = 10;

      // Process types only if filter includes types
      let limitedTypes: any[] = [];
      if (filter.includes("all") || filter.includes("types")) {
        const processedTypes = filterAndSortItems(
          schemaJson.data.__schema.types,
          searchTerm,
          MAX_RESULTS,
        );
        wasTruncated = processedTypes.wasTruncated;
        limitedTypes = processedTypes.items;
      }

      // Find the Query and Mutation types
      const queryType = schemaJson.data.__schema.types.find(
        (type: any) => type.name === queryTypeName,
      );
      const mutationType = schemaJson.data.__schema.types.find(
        (type: any) => type.name === mutationTypeName,
      );

      // Process queries if available
      let matchingQueries: any[] = [];
      if (
        queryType &&
        queryType.fields &&
        (filter.includes("all") || filter.includes("queries"))
      ) {
        // Filter out deprecated queries first
        const validQueries = filterDeprecatedFields(queryType.fields);
        const processedQueries = filterAndSortItems(
          validQueries,
          searchTerm,
          MAX_RESULTS,
        );
        queriesWereTruncated = processedQueries.wasTruncated;
        matchingQueries = processedQueries.items;
      }

      // Process mutations if available
      let matchingMutations: any[] = [];
      if (
        mutationType &&
        mutationType.fields &&
        (filter.includes("all") || filter.includes("mutations"))
      ) {
        // Filter out deprecated mutations first
        const validMutations = filterDeprecatedFields(mutationType.fields);
        const processedMutations = filterAndSortItems(
          validMutations,
          searchTerm,
          MAX_RESULTS,
        );
        mutationsWereTruncated = processedMutations.wasTruncated;
        matchingMutations = processedMutations.items;
      }

      // Create a modified schema that includes matching types
      resultSchema = {
        data: {
          __schema: {
            ...schemaJson.data.__schema,
            types: limitedTypes,
            matchingQueries,
            matchingMutations,
          },
        },
      };
    }
  }

  // Build the result with structured data
  const result: IntrospectionResult = {
    types: [],
    typesWereTruncated: wasTruncated,
    queries: [],
    queriesWereTruncated,
    mutations: [],
    mutationsWereTruncated,
  };

  // Process types if showing all or types
  if (filter.includes("all") || filter.includes("types")) {
    if (resultSchema.data.__schema.types.length > 0) {
      result.types = resultSchema.data.__schema.types.map((type: any) => ({
        name: type.name,
        description: type.description,
        details: formatSchemaType(type, truncationManager),
        scopes: getScopes(offlineScopes, type.name),
      }));
    }
  }

  // Process queries if showing all or queries
  if (filter.includes("all") || filter.includes("queries")) {
    if (resultSchema.data.__schema.matchingQueries?.length > 0) {
      result.queries = resultSchema.data.__schema.matchingQueries.map(
        (query: any) => {
          // Get scopes with inheritance logic
          let scopes = getScopes(offlineScopes, queryTypeName, query.name);

          // If no field-level scopes, check the return type
          if (!scopes || scopes.length === 0) {
            // Get the base type name (remove ! and [] modifiers)
            let returnTypeName = formatType(query.type);
            returnTypeName = returnTypeName.replace(/[\[\]!]/g, "").trim();

            // Try the return type directly
            scopes = getScopes(offlineScopes, returnTypeName);

            // If the return type is a Connection type, try the base type
            if (
              (!scopes || scopes.length === 0) &&
              returnTypeName.endsWith("Connection")
            ) {
              const baseTypeName = returnTypeName.replace(/Connection$/, "");
              scopes = getScopes(offlineScopes, baseTypeName);
            }
          }

          return {
            name: query.name,
            description: query.description,
            details: formatGraphqlOperation(
              query,
              queryTypeName,
              offlineScopes,
              truncationManager,
            ),
            scopes: scopes || [],
          };
        },
      );
    }
  }

  // Process mutations if showing all or mutations
  if (filter.includes("all") || filter.includes("mutations")) {
    if (resultSchema.data.__schema.matchingMutations?.length > 0) {
      result.mutations = resultSchema.data.__schema.matchingMutations.map(
        (mutation: any) => {
          // Get scopes with inheritance logic
          let scopes = getScopes(
            offlineScopes,
            mutationTypeName,
            mutation.name,
          );

          // If no field-level scopes, check the return type
          if (!scopes || scopes.length === 0) {
            // Get the base type name (remove ! and [] modifiers)
            let returnTypeName = formatType(mutation.type);
            returnTypeName = returnTypeName.replace(/[\[\]!]/g, "").trim();

            // Try the return type directly
            scopes = getScopes(offlineScopes, returnTypeName);

            // If the return type is a Connection type, try the base type
            if (
              (!scopes || scopes.length === 0) &&
              returnTypeName.endsWith("Connection")
            ) {
              const baseTypeName = returnTypeName.replace(/Connection$/, "");
              scopes = getScopes(offlineScopes, baseTypeName);
            }
          }

          return {
            name: mutation.name,
            description: mutation.description,
            details: formatGraphqlOperation(
              mutation,
              mutationTypeName,
              offlineScopes,
              truncationManager,
            ),
            scopes: scopes || [],
          };
        },
      );
    }
  }

  // Apply smart truncation algorithm
  // First, calculate structural tokens (field names, types, formatting)
  const calculateStructuralChars = (items: GraphQLSchemaItem[]): number => {
    return items.reduce((sum, item) => {
      // Count non-description parts of the details
      const withoutDesc = item.details.replace(/\{\{[^}]+\}\}/g, ""); // Remove placeholders
      return sum + withoutDesc.length;
    }, 0);
  };

  // Add structural tokens for all sections
  if (result.types.length > 0) {
    truncationManager.addStructuralTokens(
      calculateStructuralChars(result.types),
    );
  }
  if (result.queries.length > 0) {
    truncationManager.addStructuralTokens(
      calculateStructuralChars(result.queries),
    );
  }
  if (result.mutations.length > 0) {
    truncationManager.addStructuralTokens(
      calculateStructuralChars(result.mutations),
    );
  }

  // Apply the smart truncation based on token limits
  truncationManager.applySmartTruncation();

  // Replace placeholders with truncated descriptions
  const replacePlaceholders = (text: string): string => {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, descId) => {
      const description = truncationManager.getDescription(descId);
      // Only replace if description exists (non-empty), otherwise keep placeholder
      return description || match;
    });
  };

  // Apply replacements to all items
  result.types = result.types.map((item) => ({
    ...item,
    details: replacePlaceholders(item.details),
  }));

  result.queries = result.queries.map((item) => ({
    ...item,
    details: replacePlaceholders(item.details),
  }));

  result.mutations = result.mutations.map((item) => ({
    ...item,
    details: replacePlaceholders(item.details),
  }));

  return result;
}

// Export internal functions for testing only
// These are not part of the public API
export const __testExports = {
  MAX_FIELDS_TO_SHOW,
  formatType,
  formatArg,
  formatField,
  formatSchemaType,
  formatGraphqlOperation,
  filterAndSortItems,
  filterDeprecatedArgs,
  filterDeprecatedFields,
  SmartTruncationManager,
  TOKEN_LIMIT,
  MIN_DESCRIPTION_LENGTH,
  CHARS_PER_TOKEN,
};
