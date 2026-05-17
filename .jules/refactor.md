## 2025-05-15 - Prefer local helpers over inline Set for uniqueness
**Smell:** Manually creating `[...new Set(array)]` when a `uniq` helper exists in `common/array.ts`.
**Learning:** The codebase has a standard `uniq` utility in `@shopify/cli-kit/common/array` that wraps `Set` in a consistent way. Using it improves readability and follows the "Reach for an existing helper" philosophy.
**Action:** Always check `common/array.ts` for existing collection helpers before manual implementation.
