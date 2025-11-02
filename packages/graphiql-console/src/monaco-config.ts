// CRITICAL: Configure workers BEFORE any editor creation
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import GraphQLWorker from 'monaco-graphql/esm/graphql.worker?worker'

// Configure Monaco environment
const globalWithME = globalThis as {
  MonacoEnvironment?: {getWorker: (_: unknown, label: string) => Worker}
}

globalWithME.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'graphql') {
      return new GraphQLWorker()
    }
    return new EditorWorker()
  },
}

export {}
