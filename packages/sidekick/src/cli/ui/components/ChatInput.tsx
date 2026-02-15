import React, {useState} from "react";
import {Box, Text, useInput} from "ink";
import {COLORS} from "../types.js";
import {TextInput} from "./TextInput.js";

export interface ChatInputProps {
  onSubmit: (text: string) => void;
}

export function ChatInput({onSubmit}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        if (history.length === 0) {
          return;
        }

        if (historyIndex === -1) {
          setDraft(value);
          setHistoryIndex(0);
          setValue(history[history.length - 1] ?? "");
        } else if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          setValue(history[history.length - 1 - (historyIndex + 1)] ?? "");
        }

        return;
      }

      if (key.downArrow) {
        if (historyIndex === -1) {
          return;
        }

        if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setValue(history[history.length - 1 - (historyIndex - 1)] ?? "");
        } else {
          setHistoryIndex(-1);
          setValue(draft);
        }

        return;
      }

      if (key.return) {
        if (value.trim().length === 0) {
          return;
        }

        setHistory([...history, value]);
        setHistoryIndex(-1);
        setDraft("");
        onSubmit(value);
        setValue("");
      }
    },
    {isActive: true},
  );

  return (
    <Box borderStyle="round" borderColor={COLORS.metadata} flexDirection="column" paddingX={1}>
      <Text bold>You</Text>
      <TextInput
        value={value}
        onChange={setValue}
        color={COLORS.tool}
        placeholder="Type a message or press Ctrl+C to exit"
      />
    </Box>
  );
}
