import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";

export interface ErrorCardProps {
  message: string;
  suggestion?: string;
}

/**
 * Boxed error display with optional suggestion.
 */
export function ErrorCard({message, suggestion}: ErrorCardProps) {
  return (
    <Box borderStyle="single" borderColor={COLORS.error} paddingX={1} flexDirection="column" marginY={1}>
      <Box>
        <Text color={COLORS.error} bold>
          Error
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text color={COLORS.error}>{message}</Text>
      </Box>
      {suggestion && (
        <Box paddingX={1} marginTop={1}>
          <Text color={COLORS.metadata}>{suggestion}</Text>
        </Box>
      )}
    </Box>
  );
}
