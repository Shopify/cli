import { describe, it, expect, vi } from "vitest";

import { createEdgeMonorailLogger } from "./monorail-logger.js";

const sampleEvent = {
  schemaId: "experiment_assignments/1.2",
  payload: {
    subjectId: "install-abc",
    experiment: "e_foo",
    group: "control",
    sourceApp: "dev-mcp",
    manualAssignment: false,
  },
};

function response(status: number): Response {
  return new Response(null, { status });
}

describe("createEdgeMonorailLogger", () => {
  it("POSTs to the edge Monorail endpoint with schema_id and payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200));
    const logger = createEdgeMonorailLogger({ fetchImpl });

    await logger.produce(sampleEvent);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://monorail-edge.shopifysvc.com/v1/produce");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json; charset=utf-8",
    });
    expect(init?.headers).toHaveProperty("X-Monorail-Edge-Event-Created-At-Ms");
    expect(JSON.parse(init?.body as string)).toEqual({
      schema_id: sampleEvent.schemaId,
      payload: sampleEvent.payload,
    });
  });

  it("respects a custom endpoint override", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200));
    const logger = createEdgeMonorailLogger({
      fetchImpl,
      endpoint: "https://example.test/ingest",
    });

    await logger.produce(sampleEvent);

    expect(fetchImpl.mock.calls[0][0]).toBe("https://example.test/ingest");
  });

  it("swallows network errors and reports via onError", async () => {
    const boom = new Error("network down");
    const fetchImpl = vi.fn().mockRejectedValue(boom);
    const onError = vi.fn();
    const logger = createEdgeMonorailLogger({ fetchImpl, onError });

    await expect(logger.produce(sampleEvent)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(boom);
  });

  it("reports non-2xx responses via onError without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(500));
    const onError = vi.fn();
    const logger = createEdgeMonorailLogger({ fetchImpl, onError });

    await expect(logger.produce(sampleEvent)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0][0] as Error).message).toContain("HTTP 500");
  });

  it("does not throw when the error reporter throws", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(500));
    const logger = createEdgeMonorailLogger({
      fetchImpl,
      onError: () => {
        throw new Error("observer failed");
      },
    });

    await expect(logger.produce(sampleEvent)).resolves.toBeUndefined();
  });

  it("passes an AbortSignal tied to the timeout", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200));
    const logger = createEdgeMonorailLogger({ fetchImpl, timeoutMs: 50 });

    await logger.produce(sampleEvent);

    const init = fetchImpl.mock.calls[0][1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
