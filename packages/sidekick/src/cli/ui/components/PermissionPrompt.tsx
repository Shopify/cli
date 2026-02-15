import React, {useState} from "react";
import {Box, Text, useInput} from "ink";
import {COLORS} from "../types.js";

export interface PermissionPromptProps {
  type: "mutation" | "shell" | "mcp_tool";
  description: string;
  detail: string;
  onConfirm: () => void;
  onDeny: () => void;
}

export function PermissionPrompt(props: PermissionPromptProps) {
  const {description, detail, onConfirm, onDeny, type} = props;
  const [selected, setSelected] = useState(0);
  const actionLabel =
    type === "mutation" ? "Yes, execute this mutation" : type === "shell" ? "Yes, run this command" : "Yes, run this tool";
  const options = [actionLabel, "No, cancel"];

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((value) => (value - 1 + options.length) % options.length);
    }

    if (key.downArrow) {
      setSelected((value) => (value + 1) % options.length);
    }

    if (input.toLowerCase() === "y") {
      onConfirm();
    }

    if (input.toLowerCase() === "n") {
      onDeny();
    }

    if (key.return) {
      if (selected === 0) {
        onConfirm();
      } else {
        onDeny();
      }
    }
  });

  return (
    <Box borderStyle="single" borderColor={COLORS.warning} flexDirection="column" paddingX={1}>
      <Text bold>Permission Required</Text>
      <Box height={1} />
      <Text>{description}</Text>
      <Box height={1} />
      <Text dimColor>{detail}</Text>
      <Box height={1} />
      {options.map((option, index) => (
        <Text key={index}>
          {index === selected ? "❯" : " "} {option}
        </Text>
      ))}
    </Box>
  );
}
