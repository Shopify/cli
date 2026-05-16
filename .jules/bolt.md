## 2025-05-14 - Optimize outputDebug to skip expensive string construction
**Learning:** outputDebug always constructs a timestamped message even when debug logging is disabled. This involves calling `new Date().toISOString()` and string concatenation, which is wasteful in the hot path of logging.
**Action:** Add an early return in `outputDebug` using `shouldOutput('debug')` to skip work when not in verbose mode.
