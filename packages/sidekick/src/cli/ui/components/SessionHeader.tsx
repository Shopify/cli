import React from "react";
import {Box, Text, useStdout} from "ink";
import {COLORS} from "../types.js";

export interface SessionHeaderProps {
  storeName: string;
  connected: boolean;
}

export function SessionHeader({storeName, connected}: SessionHeaderProps) {
  const {stdout} = useStdout();
  const statusText = connected ? "Live" : "Offline";
  const statusColor = connected ? COLORS.success : COLORS.error;
  const dot = "●";
  const termWidth = stdout?.columns ?? 80;
  // Rendered: ─── ♾︎ Sidekick ─── storeName ───separator─── ● statusText ───
  // "─── " = 4, "♾︎ " = 3 (2-col symbol + space), Sidekick = 8, " ─── " = 5,
  // storeName, " " = 1, " " = 1, ● = 2 (safe), " " = 1, statusText, " ───" = 4
  const LOGO_WIDTH = 3; // "♾︎ " = 2-col symbol + space
  const DOT_WIDTH = 2; // ● may be 2 columns in some terminals
  const fixedLength = 4 + LOGO_WIDTH + "Sidekick".length + 5 + storeName.length + 1 + 1 + DOT_WIDTH + 1 + statusText.length + 4;
  const separatorLength = Math.max(1, termWidth - fixedLength);
  const separator = "─".repeat(separatorLength);

  return (
    <Box>
      <Text color={COLORS.metadata}>─── </Text>
      <Text color="magenta" bold>♾︎ </Text>
      <Text bold>Sidekick</Text>
      <Text color={COLORS.metadata}> ─── </Text>
      <Text color={COLORS.tool}>{storeName}</Text>
      <Text color={COLORS.metadata}> {separator} </Text>
      <Text color={statusColor}>{dot}</Text>
      <Text> {statusText}</Text>
      <Text color={COLORS.metadata}> ───</Text>
    </Box>
  );
}
