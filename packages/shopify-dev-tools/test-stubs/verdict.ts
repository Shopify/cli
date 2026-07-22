export type VariantAssignment = string;
export type VerdictError = unknown;

export interface VerdictUserConfiguration {
  apiKey: string;
  appName: string;
  useEdgeApi: boolean;
  cacheConfiguration: {
    cacheTTLSeconds: number;
    staleWhileRevalidateSeconds: number;
    staleIfErrorSeconds: number;
  };
  fetchOptions: { timeout: number };
  logger: {
    produce(event: { schemaId: string; payload: unknown }): Promise<void>;
  };
  onError(err: unknown): void;
}

export class Verdict {
  constructor(_config: VerdictUserConfiguration) {}

  async assignVariant(): Promise<VariantAssignment> {
    throw new Error(
      "The Verdict client is unavailable in the public repository test environment.",
    );
  }

  async flagEnabled(): Promise<boolean> {
    throw new Error(
      "The Verdict client is unavailable in the public repository test environment.",
    );
  }
}
