import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";
import {formatTime} from "../utils/format.js";
import {renderMarkdown} from "../utils/markdown.js";
import {SidekickLogo} from "./SidekickLogo.js";

export interface AssistantMessageProps {
  content: string;
  timestamp: Date;
}

export function AssistantMessage({content, timestamp}: AssistantMessageProps) {
  const time = formatTime(timestamp);

  return (
    <Box flexDirection="column">
      <Box>
        <SidekickLogo />
        <Text bold color={COLORS.sidekick}> Sidekick</Text>
        <Text color={COLORS.metadata}> ── </Text>
        <Text color={COLORS.metadata}>{time}</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {renderMarkdown(content)}
      </Box>
    </Box>
  );
}
