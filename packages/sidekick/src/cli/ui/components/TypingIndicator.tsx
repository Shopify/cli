import React, {useState, useLayoutEffect} from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";
import {LiveDot} from "./LiveDot.js";

/**
 * Animated "typing" indicator shown when Sidekick is thinking.
 */
export function TypingIndicator() {
  const [dots, setDots] = useState("");

  useLayoutEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const animate = () => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
      timeoutId = setTimeout(animate, 400);
    };

    timeoutId = setTimeout(animate, 400);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLORS.sidekick}>
          Sidekick
        </Text>
        <Text color={COLORS.metadata}> ─── </Text>
        <LiveDot active={true} />
        <Text color={COLORS.metadata}> ──────────────────────────────────────────</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={COLORS.metadata}>Thinking{dots}</Text>
      </Box>
    </Box>
  );
}
