## 2026-05-25 - Harden sanitizeRelativePath

**Context**: Identified a directory traversal vulnerability in `sanitizeRelativePath` (`packages/cli-kit/src/public/node/path.ts`) where absolute paths and Windows drive letters were not stripped, potentially allowing escapes when joined.

**Action**: Hardened `sanitizeRelativePath` to strip empty segments (leading/multiple slashes) and Windows drive letters. Updated JSDoc and the warning message to reflect these changes.

**Learning**: When sanitizing paths intended to be relative, always strip leading slashes and platform-specific root markers (like drive letters) to prevent absolute path escapes.
