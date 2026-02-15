import React, {useLayoutEffect, useState} from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";
import {formatDuration} from "../utils/format.js";

export interface ToolCallCardProps {
  name: string;
  status: "running" | "done" | "error";
  summary: string;
  detail?: string;
  duration: number;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function ToolCallCard({name, status, summary, detail, duration}: ToolCallCardProps) {
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  useLayoutEffect(() => {
    if (status !== "running") {
      return undefined;
    }

    const timer = setTimeout(() => {
      setSpinnerIndex((index) => (index + 1) % SPINNER_FRAMES.length);
    }, 80);

    return () => clearTimeout(timer);
  }, [spinnerIndex, status]);

  const statusLabel = status === "running" ? "running" : status === "done" ? "done" : "error";
  const statusSymbol =
    status === "running" ? SPINNER_FRAMES[spinnerIndex] ?? "⠋" : status === "done" ? "✓" : "✖";
  const statusColor =
    status === "running" ? COLORS.warning : status === "done" ? COLORS.success : COLORS.error;
  const durationText = formatDuration(duration);

  return (
    <Box borderStyle="single" borderColor={COLORS.metadata} flexDirection="column" paddingX={1}>
      <Box>
        <Text color={COLORS.tool}>{name}</Text>
        <Text color={COLORS.metadata}> ── </Text>
        <Text color={statusColor}>{statusSymbol}</Text>
        <Text> {statusLabel} </Text>
        <Text color={COLORS.metadata}>── {durationText}</Text>
      </Box>
      {summary && <Text>{summary}</Text>}
      {detail && <Text dimColor>{detail}</Text>}
    </Box>
  );
}
