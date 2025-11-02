// CRITICAL: Configure Monaco BEFORE any editor creation
// Monaco expects an AMD-style loader configuration

const globalWithME = globalThis as any

// Set up Monaco's environment with proper module resolution
globalWithME.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    // Return empty - GraphiQL will handle workers internally
    return ''
  },
}

export {}
