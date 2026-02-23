# App Module Architecture

## The Vision

The system has three layers: the **API** (server defines module types and contracts), the **Client** (CLI encodes and sends), and the **User Interface** (TOML files developers write). A module type is defined jointly by the API and Client layers — the server contributes the contract, the CLI contributes the encoding. The TOML is the input/output.

One class — `AppModule` — represents the complete module type definition. It combines what the client knows (how to extract, encode, build, dev) with what the server provides (contract schema, limits, features). Remote metadata is part of the module, not something bolted onto instances after the fact.

`ModuleInstance` is a specific occurrence — config from a TOML file paired with its module type. Lightweight. Delegates behavior to its module. For dynamic modules like webhook subscriptions, one module type has many instances.

## The Interface

```typescript
class AppModule<TToml, TContract> {
  identifier: string
  uidStrategy: 'single' | 'dynamic' | 'uuid'
  tomlKeys?: string[]
  remote?: RemoteModuleMetadata     // enriched from server at load time

  extract(content): TToml | undefined
  async encode(toml, context): Promise<TContract>
  decode?(contract): TToml
  async build?(instance, options): Promise<void>
  patchForDev?(config, urls): void
  // ... other optional capabilities
}
```

## Documents

| # | Document | What |
|---|----------|------|
| 01 | [Current State](./01-problem-and-inventory.md) | The old system, its 6-point pipeline, 8 problems |
| 02 | [Interface Design](./02-narrow-waist-design.md) | AppModule prototype validation |
| 03 | [Removal Blockers](./03-removal-blockers-audit.md) | What prevents removing old infrastructure |
| 04 | [Legacy Sunset](./04-legacy-sunset-plan.md) | 6 legacy flows, sunset approaches |
| 05 | [End State Proposal](./05-end-state-proposal.md) | Complete architecture: three layers, class design, problems→solutions |
| P1 | [Phase 1 Plan](./phase-1-plan.md) | AppModule class + 9 config modules + callsite wiring |
| P2 | [Phase 2 Plan](./phase-2-plan.md) | All non-config extensions as AppModule subclasses (14 independent PRs) |
| P3 | [Phase 3 Plan](./phase-3-plan.md) | Replace ExtensionInstance with ModuleInstance (no bridge needed) |
| P4 | [Phase 4 Plan](./phase-4-plan.md) | Delete old infrastructure |
| P5 | [Phase 5 Plan](./phase-5-plan.md) | Per-module format convergence |
