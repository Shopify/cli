# Testing Instructions for PR - Fix Bundling Errors Display (Issue #2092)

## Background
This PR fixes issue #2092 where bundling errors were not visible without using the `--verbose` flag. The fix ensures that when UI extensions or web pixels fail to bundle, the error details are displayed in the command output.

## Test Files Provided

1. **`test-bundling-error-example.ts`** - A file with intentional syntax and compilation errors
2. **`manual-test-error-visibility.ts`** - A test script that verifies errors are displayed properly

## How to Test

### Option 1: Run the Manual Test Script

```bash
cd packages/app
pnpm tsx manual-test-error-visibility.ts
```

This script will:
- Try to bundle code with various types of errors
- Verify that errors are displayed to stderr
- Check that the error output contains proper error markers and details
- Test both inline errors and file import errors

**Expected output:**
- You should see detailed error messages displayed
- The test should report "✅ SUCCESS: Issue #2092 is fixed"

### Option 2: Test with Real Extension

1. Create a UI extension with an intentional error:
```bash
cd packages/app
# Edit any extension file to include a syntax error, for example:
# - Remove a closing parenthesis
# - Import from a non-existent module
# - Use an undefined variable
```

2. Run the build command:
```bash
pnpm shopify app build
```

**Before this fix:** You would see a generic error without details unless using `--verbose`
**After this fix:** You should see the actual bundling errors with details about what went wrong

### Option 3: Run Existing Tests

The existing test suite already verifies this behavior:
```bash
cd packages/app
pnpm test src/cli/services/extensions/bundle.test.ts
```

Look for the test: "throws error when bundling fails and displays formatted errors"

## What to Verify

1. ✅ When bundling fails, error details are shown without needing `--verbose`
2. ✅ Error output includes `[ERROR]` markers
3. ✅ Error messages include specific details about what failed (file, line, error type)
4. ✅ The build process still fails appropriately when errors occur
5. ✅ The simplified code maintains the same functionality with less complexity

## Code Changes Summary

The PR simplifies the error handling while maintaining the fix for #2092:
- Removed unnecessary `ErrorWithErrors` interface
- Simplified error catching logic in `extension.ts`
- Kept the essential `onResult` function that writes errors to stderr
- All error display functionality remains intact

## Cleanup

After testing, you can remove the test files:
```bash
rm test-bundling-error-example.ts manual-test-error-visibility.ts TEST_INSTRUCTIONS.md
```