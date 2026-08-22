const EDGE_MONORAIL_ENDPOINT =
  "https://monorail-edge.shopifysvc.com/v1/produce";

/**
 * Structural shape of a Verdict telemetry event. Verdict's `EventLogger`
 * interface expects `produce(event: { schemaId; payload })` — the exact union
 * of schemas isn't re-exported from `@shopify/verdict/node`, so we type it
 * structurally here.
 */
export interface VerdictTelemetryEvent {
  schemaId: string;
  payload: unknown;
}

export interface MonorailLoggerOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  onError?: (err: unknown) => void;
  timeoutMs?: number;
}

export interface MonorailLogger {
  produce(event: VerdictTelemetryEvent): Promise<void>;
}

function reportError(onError: (err: unknown) => void, err: unknown): void {
  try {
    onError(err);
  } catch {
    // Telemetry failures, including failure handlers, must never break callers.
  }
}

export function createEdgeMonorailLogger(
  options: MonorailLoggerOptions = {},
): MonorailLogger {
  const endpoint = options.endpoint ?? EDGE_MONORAIL_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;
  const onError = options.onError ?? (() => {});
  const timeoutMs = options.timeoutMs ?? 2000;

  return {
    async produce(event: VerdictTelemetryEvent): Promise<void> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Monorail-Edge-Event-Created-At-Ms": String(Date.now()),
          },
          body: JSON.stringify({
            schema_id: event.schemaId,
            payload: event.payload,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          reportError(
            onError,
            new Error(
              `Monorail produce failed with HTTP ${response.status} ${response.statusText}`.trim(),
            ),
          );
        }
      } catch (err) {
        reportError(onError, err);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
