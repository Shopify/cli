import React from "react";
import {Text, useInput} from "ink";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  color?: string;
  focus?: boolean;
  placeholder?: string;
}

export function TextInput({
  value,
  onChange,
  color,
  focus = true,
  placeholder,
}: TextInputProps) {
  useInput(
    (input, key) => {
      if (!focus) {
        return;
      }

      if (key.return || key.leftArrow || key.rightArrow || key.tab) {
        return;
      }

      if (key.backspace || key.delete) {
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        }

        return;
      }

      if (key.ctrl && input === "c") {
        return;
      }

      if (input.length > 0) {
        onChange(value + input);
      }
    },
    {isActive: focus},
  );

  const cursor = focus ? "▎" : "";
  const displayValue = value.length > 0 ? value : placeholder ?? "";

  return (
    <Text color={color} dimColor={value.length === 0 && Boolean(placeholder)}>
      {displayValue}
      {cursor}
    </Text>
  );
}
