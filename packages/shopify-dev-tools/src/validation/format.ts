import { randomUUID } from "crypto";
import {
  ValidationResult,
  type ValidationResponse,
  type ValidationToolResult,
} from "../types/index.js";
import { hasFailedValidation } from "./index.js";

export interface ArtifactInfo {
  artifactId: string;
  revision: number;
}

export function extractArtifactsFromItems<
  T extends { artifactId?: string; revision?: number },
>(items: T[]): ArtifactInfo[] {
  return items.map((item) => ({
    artifactId: item.artifactId || `artifact-${randomUUID()}`,
    revision: item.revision ?? 1,
  }));
}

export function attachArtifactIds(
  responses: ValidationToolResult,
  artifacts: ArtifactInfo[],
): ValidationToolResult {
  return responses.map((r: ValidationResponse, idx: number) => {
    const artifact = artifacts[idx];
    if (!artifact) {
      return r;
    }
    return {
      ...r,
      artifactId: artifact.artifactId,
      artifactRevision: artifact.revision,
    };
  });
}

export function formatValidationResult(
  result: ValidationToolResult,
  itemName: string = "Items",
): string {
  const hasFailed = hasFailedValidation(result);
  const hasInform = result.some((r) => r.result === ValidationResult.INFORM);

  let overallStatus: string;
  if (hasFailed) {
    overallStatus = "❌ INVALID";
  } else if (hasInform) {
    overallStatus = "⚠️ VALID (with warnings)";
  } else {
    overallStatus = "✅ VALID";
  }

  let responseText = `## Validation Summary\n\n`;
  responseText += `**Overall Status:** ${overallStatus}\n`;
  responseText += `**Total ${itemName}:** ${result.length}\n\n`;

  responseText += `## Detailed Results\n\n`;
  result.forEach((check: ValidationResponse, index: number) => {
    let statusIcon: string;
    if (check.result === ValidationResult.SUCCESS) {
      statusIcon = "✅";
    } else if (check.result === ValidationResult.INFORM) {
      statusIcon = "⚠️";
    } else {
      statusIcon = "❌";
    }

    responseText += `### ${itemName.slice(0, -1)} ${index + 1}\n`;
    if (check.artifactId) {
      responseText += `**Artifact ID:** ${check.artifactId}`;
      if (check.artifactRevision) {
        responseText += `\n**Revision:** ${check.artifactRevision}`;
      }
      responseText += `\n*Use same ID & increment revision when retrying on an improvement of this artifact*\n\n`;
    }
    responseText += `**Status:** ${statusIcon} ${check.result.toUpperCase()}\n`;
    responseText += `**Details:** ${check.resultDetail}\n\n`;
  });

  return responseText;
}
