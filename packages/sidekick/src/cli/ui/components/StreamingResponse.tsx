import React from "react";
import {Box, Text, useStdout} from "ink";
import {COLORS} from "../types.js";
import {formatTime} from "../utils/format.js";
import {LiveDot} from "./LiveDot.js";

export interface StreamingResponseProps {
  chunks: string[];
  isStreaming: boolean;
}

export function StreamingResponse({chunks, isStreaming}: StreamingResponseProps) {
  const {stdout} = useStdout();
  const content = chunks.join("");
  const time = formatTime(new Date());
  const cursor = isStreaming ? "█" : "";
  const termWidth = stdout?.columns ?? 80;
  // Rendered: ♾︎ Sidekick ─── ● ───separator─── time ─
  // ♾︎  = 3, Sidekick = 8, " ─── " = 5, ● = 1, " " = 1, " " = 1, time, " ─" = 2
  const LOGO_WIDTH = 3; // "♾︎ " = 2-col symbol + space
  const fixedChars = LOGO_WIDTH + "Sidekick".length + 5 + 1 + 1 + 1 + time.length + 2;
  const separatorLength = Math.max(1, termWidth - fixedChars);
  const separator = "─".repeat(separatorLength);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="magenta" bold>♾︎ </Text>
        <Text bold color={COLORS.sidekick}>Sidekick</Text>
        <Text color={COLORS.metadata}> ─── </Text>
        <LiveDot active />
        <Text color={COLORS.metadata}> {separator} </Text>
        <Text color={COLORS.metadata}>{time}</Text>
        <Text color={COLORS.metadata}> ─</Text>
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
