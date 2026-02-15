import React from "react";
import {Box, Text, useStdout} from "ink";
import {COLORS} from "../types.js";
import {formatTime} from "../utils/format.js";
import {renderMarkdown} from "../utils/markdown.js";

export interface AssistantMessageProps {
  content: string;
  timestamp: Date;
}

export function AssistantMessage({content, timestamp}: AssistantMessageProps) {
  const {stdout} = useStdout();
  const time = formatTime(timestamp);
  const termWidth = stdout?.columns ?? 80;
  // Rendered: ♾︎ Sidekick ───separator─── time ─
  // ♾︎ (2-col symbol + 1 space) = 3, Sidekick = 8, spaces around separator = 2, time, space + dash = 2
  const LOGO_WIDTH = 3; // "♾︎ " = 2-col symbol + space
  const fixedChars = LOGO_WIDTH + "Sidekick".length + 1 + 1 + time.length + 1 + 1;
  const separatorLength = Math.max(1, termWidth - fixedChars);
  const separator = "─".repeat(separatorLength);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="magenta" bold>♾︎ </Text>
        <Text bold color={COLORS.sidekick}>Sidekick</Text>
        <Text color={COLORS.metadata}> {separator} </Text>
        <Text color={COLORS.metadata}>{time}</Text>
        <Text color={COLORS.metadata}> ─</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {renderMarkdown(content)}
      </Box>
    </Box>
  );
}
