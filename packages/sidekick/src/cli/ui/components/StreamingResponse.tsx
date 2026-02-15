import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";
import {formatTime} from "../utils/format.js";
import {LiveDot} from "./LiveDot.js";
import {SidekickLogo} from "./SidekickLogo.js";

export interface StreamingResponseProps {
  chunks: string[];
  isStreaming: boolean;
}

export function StreamingResponse({chunks, isStreaming}: StreamingResponseProps) {
  const content = chunks.join("");
  const time = formatTime(new Date());
  const cursor = isStreaming ? "█" : "";

  return (
    <Box flexDirection="column">
      <Box>
        <SidekickLogo />
        <Text bold color={COLORS.sidekick}> Sidekick</Text>
        <Text color={COLORS.metadata}> ── </Text>
        <LiveDot active />
        <Text color={COLORS.metadata}> ── </Text>
        <Text color={COLORS.metadata}>{time}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text>
          {content}
          <Text color={COLORS.streaming}>{cursor}</Text>
        </Text>
      </Box>
    </Box>
  );
}
