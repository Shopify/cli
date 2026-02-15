import {useState, useCallback} from "react";
import type {
  CompletedTurn,
  ActiveTurn,
  TurnSegment,
  SessionInfo,
  ToolCallInfo,
  ToolCallResult,
  PermissionInfo,
  ErrorInfo,
} from "../types.js";

export interface UseChatOptions {
  storeName: string;
}

export interface UseChatReturn {
  turns: CompletedTurn[];
  activeTurn: ActiveTurn | null;
  connected: boolean;
  addUserMessage: (content: string) => void;
  addAssistantChunk: (chunk: string) => void;
  startToolCall: (name: string, description: string) => void;
  completeToolCall: (result: string) => void;
  failToolCall: (error: string) => void;
  requestPermission: (request: PermissionInfo) => void;
  resolvePermission: (approved: boolean) => void;
  setError: (error: ErrorInfo) => void;
  completeTurn: () => void;
  setThinking: () => void;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const [turns, setTurns] = useState<CompletedTurn[]>([]);
  const [activeTurn, setActiveTurn] = useState<ActiveTurn | null>(null);
  const [session, setSession] = useState<SessionInfo>({
    storeName: options.storeName,
    connected: true,
    mode: "chat",
  });

  const addUserMessage = useCallback((content: string) => {
    setActiveTurn({
      phase: "thinking",
      chunks: [],
      userMessage: content,
      timestamp: new Date(),
      completedSegments: [],
    });
  }, []);

  const addAssistantChunk = useCallback((chunk: string) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      return {
        ...prev,
        phase: "streaming",
        chunks: [...prev.chunks, chunk],
      };
    });
  }, []);

  const setThinking = useCallback(() => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      return {
        ...prev,
        phase: "thinking",
      };
    });
  }, []);

  const startToolCall = useCallback((name: string, description: string) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      // Flush accumulated chunks into a text segment before the tool call
      const segments: TurnSegment[] = [...prev.completedSegments];
      const text = prev.chunks.join("");
      if (text) {
        segments.push({type: "text", content: text});
      }
      const toolCall: ToolCallInfo = {
        name,
        description,
        startTime: Date.now(),
        status: "running",
      };
      return {
        ...prev,
        phase: "tool_call",
        chunks: [],
        completedSegments: segments,
        activeToolCall: toolCall,
      };
    });
  }, []);

  const completeToolCall = useCallback((result: string) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev || !prev.activeToolCall) return prev;
      const completedTool: ToolCallResult = {
        ...prev.activeToolCall,
        status: "done",
        result,
        duration: Date.now() - prev.activeToolCall.startTime,
      };
      return {
        ...prev,
        phase: "streaming",
        activeToolCall: undefined,
        completedSegments: [...prev.completedSegments, {type: "tool_call", toolCall: completedTool}],
      };
    });
  }, []);

  const failToolCall = useCallback((error: string) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev || !prev.activeToolCall) return prev;
      const failedTool: ToolCallResult = {
        ...prev.activeToolCall,
        status: "error",
        error,
        duration: Date.now() - prev.activeToolCall.startTime,
      };
      return {
        ...prev,
        phase: "streaming",
        activeToolCall: undefined,
        completedSegments: [...prev.completedSegments, {type: "tool_call", toolCall: failedTool}],
      };
    });
  }, []);

  const requestPermission = useCallback((request: PermissionInfo) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      return {
        ...prev,
        phase: "permission",
        permissionRequest: request,
      };
    });
  }, []);

  const resolvePermission = useCallback((approved: boolean) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      return {
        ...prev,
        phase: "streaming",
        permissionRequest: undefined,
      };
    });
  }, []);

  const setError = useCallback((error: ErrorInfo) => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      return {
        ...prev,
        phase: "error",
        error,
      };
    });
  }, []);

  const completeTurn = useCallback(() => {
    setActiveTurn((prev: ActiveTurn | null) => {
      if (!prev) return null;
      // Flush any remaining chunks into a final text segment
      const segments: TurnSegment[] = [...prev.completedSegments];
      const text = prev.chunks.join("");
      if (text) {
        segments.push({type: "text", content: text});
      }
      const completedTurn: CompletedTurn = {
        userMessage: prev.userMessage || "",
        segments,
        timestamp: prev.timestamp,
      };
      setTurns((prevTurns: CompletedTurn[]) => [...prevTurns, completedTurn]);
      return null;
    });
  }, []);

  return {
    turns,
    activeTurn,
    connected: session.connected,
    addUserMessage,
    addAssistantChunk,
    startToolCall,
    completeToolCall,
    failToolCall,
    requestPermission,
    resolvePermission,
    setError,
    completeTurn,
    setThinking,
  };
}
