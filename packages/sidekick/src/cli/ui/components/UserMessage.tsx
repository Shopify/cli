import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";
import {formatTime} from "../utils/format.js";

export interface UserMessageProps {
  content: string;
  timestamp: Date;
}

export function UserMessage({content, timestamp}: UserMessageProps) {
  const time = formatTime(timestamp);

  return (
    <Box borderStyle="round" borderColor={COLORS.metadata} flexDirection="column" paddingX={1}>
      <Box>
        <Text bold>You</Text>
        <Text color={COLORS.metadata}> ── </Text>
        <Text color={COLORS.metadata}>{time}</Text>
      </Box>
      <Text>{content}</Text>
    </Box>
  );
}
