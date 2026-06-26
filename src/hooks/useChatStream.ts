// useChatStream.ts — React hook for consuming streaming AI responses via Tauri events.

import { useState, useRef, useCallback, useEffect } from "react";
import { isTauriEnv, tryInvoke, TauriCommands } from "../lib/bridge/tauri";
import { sendChat, type ChatMessage } from "../lib/ai/ai";

export interface StreamState {
  /** Current accumulated response text */
  content: string;
  /** Whether a stream is in progress */
  streaming: boolean;
  /** Error message if any */
  error: string | null;
  /** Time elapsed since stream started (ms) */
  elapsed: number;
}

export interface UseChatStreamReturn {
  /** Current stream state */
  state: StreamState;
  /** Start a streaming chat. Falls back to non-streaming in browser mode. */
  startStream: (params: {
    providerId: string;
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }) => Promise<void>;
  /** Cancel the current stream */
  cancelStream: () => void;
  /** Clear the current response */
  clearResponse: () => void;
}

/**
 * React hook for streaming AI chat responses via Tauri events.
 *
 * In Tauri mode: uses chat_stream command with SSE events for real-time tokens.
 * In browser mode: falls back to sendChat (non-streaming).
 */
export function useChatStream(): UseChatStreamReturn {
  const [state, setState] = useState<StreamState>({
    content: "",
    streaming: false,
    error: null,
    elapsed: 0,
  });

  const unlistenRef = useRef<Array<() => void>>([]);
  const startTimeRef = useRef<number>(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelledRef = useRef(false);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current.forEach((fn) => fn());
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const clearResponse = useCallback(() => {
    setState({ content: "", streaming: false, error: null, elapsed: 0 });
  }, []);

  const cancelStream = useCallback(() => {
    cancelledRef.current = true;
    unlistenRef.current.forEach((fn) => fn());
    unlistenRef.current = [];
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setState((prev) => ({ ...prev, streaming: false }));
  }, []);

  const startStream = useCallback(
    async (params: {
      providerId: string;
      model: string;
      messages: ChatMessage[];
      temperature?: number;
      maxTokens?: number;
    }) => {
      // Reset state
      cancelledRef.current = false;
      setState({ content: "", streaming: true, error: null, elapsed: 0 });
      startTimeRef.current = Date.now();

      // Start elapsed timer
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsed: Date.now() - startTimeRef.current,
        }));
      }, 100);

      if (!isTauriEnv()) {
        // Browser fallback: non-streaming
        try {
          const response = await sendChat({
            providerId: params.providerId,
            model: params.model,
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
            maxTokens: params.maxTokens ?? 2048,
          });
          if (!cancelledRef.current) {
            setState({
              content: response,
              streaming: false,
              error: null,
              elapsed: Date.now() - startTimeRef.current,
            });
          }
        } catch (e: any) {
          if (!cancelledRef.current) {
            setState((prev) => ({
              ...prev,
              streaming: false,
              error: e?.message || String(e),
            }));
          }
        } finally {
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        }
        return;
      }

      // Tauri mode: streaming via events
      try {
        // Import event listener
        const { listen } = await import("@tauri-apps/api/event");

        // Set up listeners
        const unlistenToken = await listen<{ token: string }>(
          "chat:token",
          (event) => {
            if (cancelledRef.current) return;
            setState((prev) => ({
              ...prev,
              content: prev.content + event.payload.token,
            }));
          },
        );

        const unlistenDone = await listen<{ content: string }>(
          "chat:done",
          (event) => {
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            if (!cancelledRef.current) {
              setState((prev) => ({
                ...prev,
                content: event.payload.content,
                streaming: false,
                elapsed: Date.now() - startTimeRef.current,
              }));
            }
            // Cleanup
            unlistenToken();
            unlistenDone();
            unlistenError();
            unlistenRef.current = [];
          },
        );

        const unlistenError = await listen<{ error: string }>(
          "chat:error",
          (event) => {
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
            if (!cancelledRef.current) {
              setState((prev) => ({
                ...prev,
                streaming: false,
                error: event.payload.error,
                elapsed: Date.now() - startTimeRef.current,
              }));
            }
            unlistenToken();
            unlistenDone();
            unlistenError();
            unlistenRef.current = [];
          },
        );

        unlistenRef.current = [unlistenToken, unlistenDone, unlistenError];

        // Start the stream
        await tryInvoke(TauriCommands.ChatStream, {
          providerId: params.providerId,
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          maxTokens: params.maxTokens ?? 2048,
        });
      } catch (e: any) {
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        // Cleanup listeners on error
        unlistenRef.current.forEach((fn) => fn());
        unlistenRef.current = [];
        if (!cancelledRef.current) {
          setState((prev) => ({
            ...prev,
            streaming: false,
            error: e?.message || String(e),
          }));
        }
      }
    },
    [],
  );

  return { state, startStream, cancelStream, clearResponse };
}
