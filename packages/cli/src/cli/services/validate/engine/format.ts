import {ValidationResult, ValidationResponse, ValidationToolResult} from './contract.js'

// CRITICAL barrel decoupling:
//
// In the source package, `format.ts` imported `hasFailedValidation` from the
// `validation/index.ts` BARREL, which statically re-exports the component
// validator and therefore pulls in `typescript` + `html-tags` + `svg-tag-names`
// for anyone who imports the formatter. The non-component subcommands
// (functions, graphql, theme) must NOT drag in the TypeScript compiler.
//
// We break that chain by inlining `hasFailedValidation` here. This module now
// depends on nothing but the pure `contract.ts` types, so importing the
// formatter costs nothing beyond string manipulation.

/**
 * Returns true when any response in the set failed validation.
 */
export function hasFailedValidation(responses: ValidationToolResult): boolean {
  return responses.some((response) => response.result === ValidationResult.FAILED)
}

/**
 * Renders a set of validation responses as the markdown summary that agents and
 * eval harnesses consume. This is a faithful port of the source
 * `formatValidationResult` — the output is intentionally identical so the CLI
 * subcommand and the original MCP tool produce the same message body.
 */
export function formatValidationResult(result: ValidationToolResult, itemName = 'Items'): string {
  const hasFailed = hasFailedValidation(result)
  const hasInform = result.some((response) => response.result === ValidationResult.INFORM)

  let overallStatus: string
  if (hasFailed) {
    overallStatus = '❌ INVALID'
  } else if (hasInform) {
    overallStatus = '⚠️ VALID (with warnings)'
  } else {
    overallStatus = '✅ VALID'
  }

  let responseText = `## Validation Summary\n\n`
  responseText += `**Overall Status:** ${overallStatus}\n`
  responseText += `**Total ${itemName}:** ${result.length}\n\n`

  responseText += `## Detailed Results\n\n`
  result.forEach((check: ValidationResponse, index: number) => {
    let statusIcon: string
    if (check.result === ValidationResult.SUCCESS) {
      statusIcon = '✅'
    } else if (check.result === ValidationResult.INFORM) {
      statusIcon = '⚠️'
    } else {
      statusIcon = '❌'
    }

    responseText += `### ${itemName.slice(0, -1)} ${index + 1}\n`
    if (check.artifactId) {
      responseText += `**Artifact ID:** ${check.artifactId}`
      if (check.artifactRevision) {
        responseText += `\n**Revision:** ${check.artifactRevision}`
      }
      responseText += `\n*Use same ID & increment revision when retrying on an improvement of this artifact*\n\n`
    }
    responseText += `**Status:** ${statusIcon} ${check.result.toUpperCase()}\n`
    responseText += `**Details:** ${check.resultDetail}\n\n`
  })

  return responseText
}
