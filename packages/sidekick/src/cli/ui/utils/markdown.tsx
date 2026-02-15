import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";

/**
 * Renders a simple markdown-like string into Ink components.
 * Supports: **bold**, `inline code`, code blocks, and bullet points.
 */
export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <Box key={`code-${index}`} borderStyle="round" borderColor={COLORS.metadata} paddingX={1} marginY={1}>
            <Text color={COLORS.code} dimColor>
              {codeBlockLines.join("\n")}
            </Text>
          </Box>,
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Handle bullet points
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const content = line.trim().slice(2);
      elements.push(
        <Box key={index} marginLeft={2}>
          <Text>• </Text>
          <Text>{renderInline(content)}</Text>
        </Box>,
      );
      return;
    }

    // Handle normal line with inline styles
    if (line.trim() === "") {
      elements.push(<Box key={index} height={1} />);
    } else {
      elements.push(
        <Box key={index}>
          <Text>{renderInline(line)}</Text>
        </Box>,
      );
    }
  });

  return elements;
}

/**
 * Helper to render inline markdown styles: **bold** and `code`
 */
function renderInline(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return tokens.map((token, i) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <Text key={i} bold>
          {token.slice(2, -2)}
        </Text>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <Text key={i} color={COLORS.code} dimColor>
          {token.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={i}>{token}</Text>;
  });
}
