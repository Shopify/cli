import React from "react";
import {Box, Text} from "ink";
import {COLORS} from "../types.js";

export interface WelcomeScreenProps {
  storeName: string;
}

/**
 * Initial splash screen shown when the session starts.
 * Mascot face with purple mask coloring.
 */
export function WelcomeScreen(_props: WelcomeScreenProps) {
  return (
    <Box flexDirection="column" alignItems="center" marginY={1}>
      <Text>╭─────╮</Text>
      <Text>│<Text color="magenta">(o=o)</Text>│</Text>
      <Text>│  ‿  │</Text>
      <Text>╰─────╯</Text>
      <Text color={COLORS.sidekick} bold>S I D E K I C K</Text>
      <Text color={COLORS.metadata}>Your AI merchant ally</Text>
      <Box height={1} />
      <Text color={COLORS.metadata}>Try: &quot;What were my top products last week?&quot;</Text>
    </Box>
  );
}
