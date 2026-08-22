/**
 * MCP-specific requirement text appended to portable instructions to produce
 * the full MCP-interpolated instruction set.
 *
 * These strings reference MCP tool names (validate_graphql_codeblocks, etc.)
 * and MUST NOT appear in portable (raw) instruction files.
 */

import { APICategory, type APIMapping } from "../types/api-types.js";

/**
 * Returns the MCP-specific requirements string for a given API.
 *
 * Dispatch order:
 *   1. If the API declares extension metadata (extensionTypeName +
 *      extensionSearchContext), emit the extension-specific block and stop.
 *      Extension APIs intentionally do NOT receive the UI_FRAMEWORK block.
 *   2. If validation is not enabled, emit nothing.
 *   3. Otherwise dispatch on category.
 */
export function getMcpRequirements(apiConfig: APIMapping): string {
  if (apiConfig.extensionTypeName && apiConfig.extensionSearchContext) {
    return getExtensionMcpRequirements(
      apiConfig.extensionTypeName,
      apiConfig.extensionSearchContext,
    );
  }

  if (!apiConfig.validation) return "";

  if (apiConfig.category === APICategory.GRAPHQL) {
    return getGraphQLMcpRequirements(apiConfig.name);
  }

  if (apiConfig.category === APICategory.UI_FRAMEWORK) {
    return getUIFrameworkMcpRequirements(apiConfig.name);
  }

  if (apiConfig.category === APICategory.FUNCTIONS) {
    return getFunctionsMcpRequirements();
  }

  if (apiConfig.category === APICategory.THEME) {
    return getThemeMcpRequirements();
  }

  return "";
}

function getGraphQLMcpRequirements(apiName?: string): string {
  const adminRestriction =
    apiName === "admin"
      ? `\n⛔ ONLY use the \`search_docs_chunks\` and \`validate_graphql_codeblocks\` MCP tools. Do NOT use \`fetch_full_docs\` or \`introspect_graphql_schema\`.\n`
      : "";
  return `${adminRestriction}

THIS IS IMPORTANT: Graphql operations you generate should ALWAYS be validated with the \`validate_graphql_codeblocks\` MCP tool. This tool will parse the operation with the GQL schema and give you feedback of errors if any were detected. If errors are detected from this validation tool, make the necessary changes and then call this tool again.

⚠️🚨 Be sure to pass the code into the \`validate_graphql_codeblocks\` tool and make any necessary corrections that tool indicates are needed. This removes LLM hallucinations from GQL operations. ️🚨⚠️`;
}

function getUIFrameworkMcpRequirements(apiName: string): string {
  return `

## Code Validation Required

⚠️ **IMPORTANT**: When generating code for this API, you MUST use the \`validate_component_codeblocks\` tool to ensure the code is valid and uses correct component names and properties. DONT ASK THE USER TO DO THIS.

Example usage:
\`\`\`
mcp_dev-mcp_validate_component_codeblocks
- conversationId: [required from learn_shopify_api]
- api: ${apiName}
- code: [array of code blocks to validate]
\`\`\``;
}

function getFunctionsMcpRequirements(): string {
  return `

- **IMPORTANT**: After generating the input GraphQL query, you SHOULD use the \`validate_graphql_codeblocks\` tool to validate it against the function's GraphQL schema
- Specify the correct function API (e.g., \`functions_cart_checkout_validation\`, \`functions_payment_customization\`, etc.) when validating
- You can use the \`introspect_graphql_schema\` tool before fixing an invalid input query, to explore available fields and types for any function API`;
}

function getThemeMcpRequirements(): string {
  return `

### Code Validation Required

⚠️ **IMPORTANT**: When generating or updating theme files, you MUST use the theme validation tool to ensure the code is valid and doesn't contain hallucinated Liquid content, invalid syntax, or incorrect references. DO NOT ASK THE USER TO DO THIS - validate automatically.

Use one of the following validation tools (only one will be available):
- \`validate_theme\` - Use when working with files in an actual theme directory
- \`validate_theme_codeblocks\` - Use when validating code blocks without a theme directory

This validation removes LLM hallucinations from theme code and ensures valid Liquid syntax. If validation errors are detected, fix the issues and validate again.`;
}

function getExtensionMcpRequirements(
  extensionType: string,
  searchContext: string,
): string {
  return `

🚨 REMINDER: DO NOT call learn_extension_target_types or fetch_full_docs for ${extensionType}. These tools are DISABLED and DEPRECATED for this API. You have all the information you need from this response.

Use search_docs_chunks to find extension target information for ${searchContext}:
A target represents where your ${extensionType.toLowerCase()} will appear.
The target decides how a component/API can be used and what are the valid prop/API values.`;
}
