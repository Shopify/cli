import React from "react";
import {Box, Text, useStdout} from "ink";
import {COLORS} from "../types.js";

export interface WelcomeScreenProps {
  storeName: string;
}

/**
 * Initial splash screen shown when the session starts.
 */
export function WelcomeScreen({storeName}: WelcomeScreenProps) {
  const {stdout} = useStdout();
  const termWidth = stdout?.columns ?? 80;
  const width = Math.min(termWidth - 4, 60);

  return (
    <Box
      borderStyle="round"
      borderColor={COLORS.sidekick}
      padding={1}
      flexDirection="column"
      alignItems="center"
      width={width}
      marginX={2}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text color="magenta" bold>♾︎</Text>
        <Text color={COLORS.sidekick} bold>  S I D E K I C K</Text>
      </Box>
      <Text color={COLORS.metadata}>Your AI merchant ally</Text>
      <Box marginTop={1}>
        <Text>Connected to </Text>
        <Text color="cyan" bold>
          {storeName}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={COLORS.metadata}>Try: "What were my top products last week?"</Text>
      </Box>
    </Box>
  );
}
