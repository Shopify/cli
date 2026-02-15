/**
 * Shared type definitions for Sidekick UI components
 */

// Session & connection state
export interface SessionInfo {
  storeName: string;
  connected: boolean;
  mode: "chat" | "command";
}

// Turn segment: preserves interleaved order of text and tool calls
export type TurnSegment =
  | {type: "text"; content: string}
  | {type: "tool_call"; toolCall: ToolCallResult};

// Chat turn structures
export interface CompletedTurn {
  userMessage: string;
  segments: TurnSegment[];
  timestamp: Date;
}

export interface ActiveTurn {
  phase: "thinking" | "streaming" | "tool_call" | "permission" | "error";
  chunks: string[];
  userMessage?: string;
  timestamp: Date;
  completedSegments: TurnSegment[];
  activeToolCall?: ToolCallInfo;
  permissionRequest?: PermissionInfo;
  error?: ErrorInfo;
}

// Tool call structures
export interface ToolCallInfo {
  name: string;
  description: string;
  startTime: number;
  status: "running" | "done" | "error";
}

export interface ToolCallResult extends ToolCallInfo {
  result?: string;
  error?: string;
  duration: number;
}

// Permission & error structures
export interface PermissionInfo {
  type: "mutation" | "shell" | "mcp_tool";
  description: string;
  detail: string;
}

export interface ErrorInfo {
  message: string;
  suggestion?: string;
}

// Color palette constants
export const COLORS = {
  sidekick: "green",
  user: undefined,
  tool: "cyan",
  code: "cyan",
  warning: "yellow",
  error: "red",
  success: "green",
  metadata: "gray",
  streaming: "greenBright",
} as const;
