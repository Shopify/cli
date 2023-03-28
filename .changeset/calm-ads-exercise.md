---
'@shopify/cli-kit': patch
---

Added 2 new utilities on the git module:

- git.ensureIsClean(directory?: string): Promise<void>: If the .git directory tree is not clean (has uncommitted changes) it throws an abort error.
- git.isClean(directory?: string): Promise<boolean>: Returns true if the .git directory tree is clean (no uncommitted changes).
