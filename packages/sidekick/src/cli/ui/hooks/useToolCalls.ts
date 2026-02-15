import {useState, useLayoutEffect} from "react";
import type {ToolCallInfo} from "../types.js";

/**
 * Hook to manage a tool call timer.
 * Provides the current duration in milliseconds for an active tool call.
 */
export function useToolCallTimer(tool: ToolCallInfo | undefined): number {
  const [duration, setDuration] = useState(0);

  useLayoutEffect(() => {
    if (!tool || tool.status !== "running") {
      return;
    }

    // Initial sync
    setDuration(Date.now() - tool.startTime);

    let timeoutId: NodeJS.Timeout;
    const tick = () => {
      setDuration(Date.now() - tool.startTime);
      timeoutId = setTimeout(tick, 100);
    };

    timeoutId = setTimeout(tick, 100);
    return () => clearTimeout(timeoutId);
  }, [tool?.status, tool?.startTime]);

  return duration;
}
