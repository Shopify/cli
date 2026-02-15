import React, {useCallback, useMemo, useRef} from "react";
import {Box, Static} from "ink";
import {useChat} from "./hooks/useChat.js";
import {SessionHeader} from "./components/SessionHeader.js";
import {UserMessage} from "./components/UserMessage.js";
import {AssistantMessage} from "./components/AssistantMessage.js";
import {WelcomeScreen} from "./components/WelcomeScreen.js";
import {ErrorCard} from "./components/ErrorCard.js";
import {ChatInput} from "./components/ChatInput.js";
import {StreamingResponse} from "./components/StreamingResponse.js";
import {ToolCallCard} from "./components/ToolCallCard.js";
import {PermissionPrompt} from "./components/PermissionPrompt.js";
import {TypingIndicator} from "./components/TypingIndicator.js";
import {useToolCallTimer} from "./hooks/useToolCalls.js";
import type {CompletedTurn, TurnSegment} from "./types.js";
import type {TerminalSession, SessionCallbacks} from "../services/terminal.js";

export interface SidekickAppProps {
  session: TerminalSession;
  storeName: string;
}

type StaticItem =
  | {type: "header"; id: string}
  | {type: "turn"; id: string; turn: CompletedTurn};

export function SidekickApp({session, storeName}: SidekickAppProps) {
  const chat = useChat({storeName});
  const {turns, activeTurn} = chat;
  const permissionResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const handleSubmit = useCallback((text: string) => {
    chat.addUserMessage(text);

    const callbacks: SessionCallbacks = {
      onChunk: (chunk: string) => {
        chat.addAssistantChunk(chunk);
      },
      onToolCallStart: (toolCall) => {
        chat.startToolCall(toolCall.name, toolCall.name);
      },
      onToolCallEnd: (_toolCallId: string, result: string, error?: string) => {
        if (error) {
          chat.failToolCall(error);
        } else {
          chat.completeToolCall(result);
        }
      },
      onPermissionRequest: async (request) => {
        chat.requestPermission({
          type: request.type,
          description: request.description,
          detail: request.detail,
        });
        return new Promise<boolean>((resolve) => {
          permissionResolverRef.current = resolve;
        });
      },
      onError: (_type: string, message: string) => {
        chat.setError({message});
      },
      onEnd: () => {
        chat.completeTurn();
      },
    };

    session.sendWithCallbacks(text, callbacks).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      chat.setError({message});
    });
  }, [chat, session]);

  const handlePermissionResolve = useCallback((approved: boolean) => {
    chat.resolvePermission(approved);
    if (permissionResolverRef.current) {
      permissionResolverRef.current(approved);
      permissionResolverRef.current = null;
    }
  }, [chat]);

  const activeToolDuration = useToolCallTimer(activeTurn?.activeToolCall);

  // Static items: header at index 0, then completed turns.
  // Ink's <Static> only renders NEW items as the array grows,
  // so the header renders once and stays at the top.
  const staticItems: StaticItem[] = useMemo(() => [
    {type: "header" as const, id: "header"},
    ...turns.map((turn, i) => ({type: "turn" as const, id: `turn-${i}`, turn})),
  ], [turns]);

  return (
    <Box flexDirection="column">
      <Static items={staticItems}>
        {(item: StaticItem) => {
          if (item.type === "header") {
            return (
              <Box key={item.id}>
                <SessionHeader storeName={storeName} connected={chat.connected} />
              </Box>
            );
          }

          const {turn} = item;
          return (
            <Box key={item.id} flexDirection="column">
              <UserMessage content={turn.userMessage} timestamp={turn.timestamp} />
              {turn.segments.map((segment: TurnSegment, j: number) => {
                if (segment.type === "tool_call") {
                  return (
                    <Box key={j} marginLeft={2}>
                      <ToolCallCard
                        name={segment.toolCall.name}
                        status={segment.toolCall.status}
                        summary={segment.toolCall.description}
                        duration={segment.toolCall.duration}
                        detail={segment.toolCall.result}
                      />
                    </Box>
                  );
                }
                return (
                  <AssistantMessage key={j} content={segment.content} timestamp={turn.timestamp} />
                );
              })}
            </Box>
          );
        }}
      </Static>

      {turns.length === 0 && !activeTurn && <WelcomeScreen storeName={storeName} />}

      {activeTurn && (
        <Box flexDirection="column">
          {/* Always show the user message during the active turn */}
          <UserMessage content={activeTurn.userMessage || ""} timestamp={activeTurn.timestamp} />

          {/* Completed segments from earlier in this turn (text + finished tool calls) */}
          {activeTurn.completedSegments.map((segment: TurnSegment, j: number) => {
            if (segment.type === "tool_call") {
              return (
                <Box key={`seg-${j}`} marginLeft={2}>
                  <ToolCallCard
                    name={segment.toolCall.name}
                    status={segment.toolCall.status}
                    summary={segment.toolCall.description}
                    duration={segment.toolCall.duration}
                    detail={segment.toolCall.result}
                  />
                </Box>
              );
            }
            return (
              <AssistantMessage key={`seg-${j}`} content={segment.content} timestamp={activeTurn.timestamp} />
            );
          })}

          {/* Current phase indicator */}
          {(activeTurn.phase === "thinking" || (activeTurn.phase === "streaming" && activeTurn.chunks.length === 0)) && (
            <TypingIndicator />
          )}

          {activeTurn.phase === "streaming" && activeTurn.chunks.length > 0 && (
            <StreamingResponse chunks={activeTurn.chunks} isStreaming={true} />
          )}

          {activeTurn.phase === "tool_call" && activeTurn.activeToolCall && (
            <Box marginLeft={2}>
              <ToolCallCard
                name={activeTurn.activeToolCall.name}
                status="running"
                summary={activeTurn.activeToolCall.description}
                duration={activeToolDuration}
              />
            </Box>
          )}

          {activeTurn.phase === "permission" && activeTurn.permissionRequest && (
            <PermissionPrompt
              {...activeTurn.permissionRequest}
              onConfirm={() => handlePermissionResolve(true)}
              onDeny={() => handlePermissionResolve(false)}
            />
          )}

          {activeTurn.phase === "error" && activeTurn.error && (
            <ErrorCard message={activeTurn.error.message} suggestion={activeTurn.error.suggestion} />
          )}
        </Box>
      )}

      {!activeTurn && (
        <Box flexDirection="column" marginTop={1}>
          <ChatInput onSubmit={handleSubmit} />
        </Box>
      )}
    </Box>
  );
}
