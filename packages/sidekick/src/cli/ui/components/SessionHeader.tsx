import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";
import {SidekickLogo} from "./SidekickLogo.js";

export interface SessionHeaderProps {
  storeName: string;
  connected: boolean;
}

export function SessionHeader({storeName, connected}: SessionHeaderProps) {
  const statusText = connected ? "Live" : "Offline";
  const statusColor = connected ? COLORS.success : COLORS.error;

  return (
    <Box borderStyle="round" borderColor={COLORS.sidekick} paddingX={1}>
      <SidekickLogo />
      <Text bold> Sidekick</Text>
      <Text color={COLORS.metadata}> ── </Text>
      <Text color={COLORS.tool}>{storeName}</Text>
      <Text color={COLORS.metadata}> ── </Text>
      <Text color={statusColor}>● </Text>
      <Text>{statusText}</Text>
    </Box>
  );
}
