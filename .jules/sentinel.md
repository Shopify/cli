# Sentinel Security Learnings

## Vulnerability: Command Injection via Shell Execution

**Learning:** Using `child_process.exec` with user-controlled input (even if partially validated) can lead to command injection if the input contains shell metacharacters. In this case, `Number.isNaN()` was incorrectly used on a string, which does not perform type coercion and can return `false` for malicious strings like `"123; calc.exe"`.

**Prevention:**
1. Use `child_process.spawn` instead of `child_process.exec` whenever possible, as it does not spawn a shell by default and arguments are passed as an array.
2. Perform strict input validation using regular expressions (e.g., `/^\d+$/` for numeric IDs) to ensure the input matches the expected format exactly.
3. Always handle the `error` event on spawned processes to prevent unhandled exceptions.
