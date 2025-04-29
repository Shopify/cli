⏺ Function Log Polling Implementation Document

  1. Problem Statement

  When running shopify app dev, function logs aren't automatically streamed if a function extension is added during an active development session. The logs polling mechanism only initializes when the CLI
   starts, not when extensions are dynamically added.

  2. Current Process Flow

  App Dev Initialization Process

  1. When shopify app dev starts, it initializes several processes through setupDevProcesses()
  2. At startup, it checks if any function extensions exist:
  let shouldPerformAppLogPolling = localApp.allExtensions.some((extension) => extension.isFunctionExtension)
  3. Based on this check, it conditionally adds a log polling process:
  shouldPerformAppLogPolling ? await setupLogsPolling() : undefined
  4. The AppEventWatcher is set up to monitor file changes and extension creation

  Extension Creation Process

  1. When a new extension is created:
    - The filesystem watcher (file-watcher.ts) detects changes to files
    - extension_folder_created or extensions_config_updated events are emitted
    - The app is reloaded via reloadApp(app) in ReloadAppHandler
    - Extension events (created/updated/deleted) are generated
  2. The appWatcher.onEvent() listener receives these events
    - However, it doesn't currently check for newly created function extensions
    - No mechanism exists to start log polling after the initial app startup

  3. Root Cause

  The root issue is that shouldPerformAppLogPolling is only evaluated once at the start of setupDevProcesses(), but there's no code to re-evaluate this when the app structure changes during a development
   session.

  When a function extension is created during an active dev session:
  1. The app is correctly reloaded, and the new function is recognized
  2. But the log polling check isn't re-run, so no log polling process is started
  3. The user must restart shopify app dev to see function logs

  4. Proposed Solution

  Add an event listener to the AppEventWatcher that specifically watches for new function extensions and starts the log polling process when one is detected.

  Key points of the solution:
  1. Make shouldPerformAppLogPolling mutable (use let instead of const) ✓
  2. Create a helper function to setup the logs polling process ✓
  3. Add an event listener to appWatcher that:
    - Detects when new function extensions are added
    - Checks if log polling is already running
    - If not, starts the log polling process and adds it to active processes
  4. Ensure the event listener handles both direct extension creation and app reload cases

  5. Implementation Details

  Code Changes Required

  1. In setup-dev-processes.ts:
  // Create a reusable helper function
  const setupLogsPolling = async () => {
    return setupAppLogsPollingProcess({
      developerPlatformClient,
      subscription: {shopIds: [Number(storeId)], apiKey},
      storeName: storeFqdn,
      organizationId: remoteApp.organizationId,
    })
  }

  // Add an event listener to monitor for function extensions
  appWatcher.onEvent(async (appEvent) => {
    // Check if the app contains function extensions after update
    const appHasFunctions = appEvent.app.allExtensions.some(ext => ext.isFunctionExtension);

    // If app has functions and polling isn't already running, start it
    if (appHasFunctions && !shouldPerformAppLogPolling) {
      shouldPerformAppLogPolling = true;

      const logsPollingProcess = await setupLogsPolling();
      if (logsPollingProcess) {
        processesWithProxy.push(logsPollingProcess);
      }
    }
  });

  Testing Scenarios

  1. Start app dev from scratch with no functions, then add a function
    - Expected: Log polling should start automatically when function is added
  2. Start app dev with an existing function
    - Expected: Log polling should start at initialization
  3. Start app dev with no functions, create multiple functions in sequence
    - Expected: Log polling should only start once, when the first function is added

  6. Acceptance Criteria

  - When a function extension is added during dev, log polling starts automatically
  - User sees visible indication that log polling has begun
  - Function logs appear in the terminal without requiring a restart
  - All existing functionality continues to work correctly

  7. Further Considerations

  1. Performance impact of adding another event listener is negligible
  2. Solution maintains backward compatibility
  3. This approach follows the existing pattern used in the codebase
  4. Making the enhancement visible to users with clear log messages will improve user experience


  // Immediate Fix
  - need some way to kick off polling when extension gets added
  // Describe Immediate Fix
  - Need some way to kick off polling when extension gets added
  - Difficult because of the way Dev processes get kicked off
    - Currently looks like with the immediate fix, we are trying to setup a watch event, then when extension gets added
      we kick off polling, but the way the code is laid out, it's not as simple as just calling the poll method, we need the
      proper process context including stdout/stderr streams and abort signals to initialize the polling correctly
    - The fix involves:
      1. Making shouldPerformAppLogPolling mutable (let instead of const)
      2. Adding an event listener to detect function extensions
      3. Creating a custom process launcher that properly passes global process.stdout/stderr
      4. Setting up proper error handling for the dynamic process launch
    - ANOTHER IDEA: we always pass the polling function as a process for the `Dev` component, but instead it has some additional like delayedStart? which
    can delay the start, until the Dev component knows that an extension has been added, then kicks off the process which some managed state.
        - 2 parts of this to me:
            - Dev needs to be able to detect those AppExtension watcher changes
            - Dev when triggering the error handles process, can then have a if else on the delayed start.
                - or manage delatyed process in some other way that can be added to by other, thinking, this seems great
  - or just always poll for functions (not good)
  -

  // long term better sollution
  - i think there might be a better way to factor this, and have say a 'delayedHandledProcess` in `Dev`.

  // We need working changes for convergence on Thursday (2 days)



  1. We identified that the shouldPerformAppLogPolling flag was only being set once at CLI startup, never getting updated when new function extensions were
  added.
  2. We implemented a solution that:
    - Made shouldPerformAppLogPolling mutable (using let instead of const)
    - Created a reusable helper function setupLogsPolling for consistent process initialization
    - Added an event listener that detects when function extensions are added
    - Implemented a generic process launcher that properly passes global stdout/stderr streams
    - Added robust error handling around the process launch
  3. We improved the code with:
    - Clear, informative logging (replacing console.log with proper outputDebug/outputInfo calls)
    - Generic type handling for the process launcher function
    - Comprehensive checks for both full app reloads and incremental extension additions

  The solution is minimal and follows the existing patterns in the codebase. When a function extension is added during development:
  1. The file watcher detects the change
  2. Our event handler identifies it as a function extension
  3. If log polling isn't already active, it starts the process with proper stdout/stderr handling
  4. The user sees function logs without needing to restart the CLI

  This should provide a much better developer experience, as they won't need to restart the dev process just to see function logs.

