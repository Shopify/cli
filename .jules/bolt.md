## 2026-05-20 - Optimize linesToColumns
**Learning:** Utilities that handle CLI output formatting, like `linesToColumns`, often call expensive regex-based helpers (e.g., `unstyled` for ANSI strip) multiple times for the same input. Caching these lengths in a single pass over the data significantly reduces overhead.
**Action:** Always check if string measurement utilities are called repeatedly in loops or nested maps, and use pre-calculation/caching to avoid redundant work.
