# Sentinel Security Learnings

## 2025-05-22 - Ineffective Numeric Validation in `treeKill`

**Vulnerability:**
The `treeKill` utility used `Number.isNaN()` on a PID that had been converted to a string. `Number.isNaN()` does not perform type coercion and returns `false` for any non-number type, including strings that are not numeric. This meant that invalid PIDs, such as those containing shell injection characters, would bypass the check and be passed to `exec()` on Windows.

**Learning:**
Never use `Number.isNaN()` for validating that a string is a number. It is intended only for checking if a value of type `number` is `NaN`. For string numeric validation, a regular expression or a combination of `isNaN(Number(val))` is required.

**Prevention:**
Use `/^\d+$/` to validate that a string contains only digits before using it in security-sensitive operations like process management or shell commands.
