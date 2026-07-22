import { Verdict } from "@shopify/verdict/node";
import type {
  VariantAssignment,
  VerdictError,
  VerdictUserConfiguration,
} from "@shopify/verdict/node";

import { getOrCreateInstallId } from "./install-id.js";
import {
  createEdgeMonorailLogger,
  type MonorailLogger,
} from "./monorail-logger.js";
import { detectOptOut, type OptOutResult } from "./opt-out.js";

export interface ExperimentsConfig {
  apiKey: string;
  appName: string;
  onError?: (err: VerdictError | unknown) => void;
  loggerOverride?: MonorailLogger;
  installIdOverride?: string;
  installIdProvider?: () => string;
  verdictFactory?: (
    config: VerdictUserConfiguration,
  ) => ExperimentsVerdictClient;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

export type ExperimentSubject = { type: "default"; subjectId: string };

export interface ExperimentsVerdictClient {
  assignVariant(
    experimentHandle: string,
    subject: ExperimentSubject,
  ): Promise<VariantAssignment>;
  flagEnabled(flagHandle: string, subject: ExperimentSubject): Promise<boolean>;
}

export class Experiments {
  private readonly verdict: ExperimentsVerdictClient | null;
  private readonly subject: ExperimentSubject | null;
  private readonly optOut: OptOutResult;
  private readonly installId: string | null;
  private readonly onError?: (err: VerdictError | unknown) => void;

  constructor(config: ExperimentsConfig) {
    this.optOut = detectOptOut(config.env);
    this.onError = config.onError;

    if (this.optOut.optedOut) {
      this.verdict = null;
      this.subject = null;
      this.installId = null;
      return;
    }

    this.installId =
      config.installIdProvider?.() ??
      config.installIdOverride ??
      getOrCreateInstallId({ env: config.env });
    this.subject = { type: "default", subjectId: this.installId };

    const logger =
      config.loggerOverride ??
      createEdgeMonorailLogger({
        fetchImpl: config.fetchImpl,
        onError: config.onError,
      });

    const verdictConfig: VerdictUserConfiguration = {
      apiKey: config.apiKey,
      appName: config.appName,
      useEdgeApi: true,
      cacheConfiguration: {
        cacheTTLSeconds: 300,
        staleWhileRevalidateSeconds: 3600,
        staleIfErrorSeconds: 86400,
      },
      fetchOptions: { timeout: 2000 },
      logger,
      onError: (err) => this.reportError(err),
    };

    this.verdict = config.verdictFactory
      ? config.verdictFactory(verdictConfig)
      : new Verdict(verdictConfig);
  }

  async assign(handle: string): Promise<string | null> {
    if (!this.verdict || !this.subject) return null;
    try {
      return await this.verdict.assignVariant(handle, this.subject);
    } catch (err) {
      this.reportError(err);
      return null;
    }
  }

  async flag(handle: string): Promise<boolean> {
    if (!this.verdict || !this.subject) return false;
    try {
      return await this.verdict.flagEnabled(handle, this.subject);
    } catch (err) {
      this.reportError(err);
      return false;
    }
  }

  private reportError(err: VerdictError | unknown): void {
    try {
      this.onError?.(err);
    } catch {
      // Experiment failures must degrade to safe defaults, even if the error
      // observer itself throws.
    }
  }

  get isActive(): boolean {
    return this.verdict !== null;
  }

  get optOutReason(): string | undefined {
    return this.optOut.optedOut ? this.optOut.reason : undefined;
  }

  get debugSubjectId(): string | null {
    return this.installId;
  }
}
