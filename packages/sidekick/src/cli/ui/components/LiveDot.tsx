import React, {useState, useLayoutEffect} from "react";
import {Text} from "ink";

export interface LiveDotProps {
  active: boolean;
}

/**
 * A pulsing dot indicator for live status.
 * Pulses green when active, static red when inactive.
 */
export function LiveDot({active}: LiveDotProps) {
  const [visible, setVisible] = useState(true);

  useLayoutEffect(() => {
    if (!active) {
      setVisible(true);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    const pulse = () => {
      setVisible((v) => !v);
      timeoutId = setTimeout(pulse, 600);
    };

    timeoutId = setTimeout(pulse, 600);
    return () => clearTimeout(timeoutId);
  }, [active]);

  if (!active) {
    return <Text color="red">●</Text>;
  }

  return <Text color={visible ? "greenBright" : "green"}>●</Text>;
}
