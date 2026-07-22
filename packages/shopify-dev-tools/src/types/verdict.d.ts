declare module "@shopify/verdict/node" {
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
    constructor(config: VerdictUserConfiguration);

    assignVariant(
      experimentHandle: string,
      subject: { type: "default"; subjectId: string },
    ): Promise<VariantAssignment>;

    flagEnabled(
      flagHandle: string,
      subject: { type: "default"; subjectId: string },
    ): Promise<boolean>;
  }
}
