import {joinPath, dirname, resolvePath} from '@shopify/cli-kit/node/path'
import {tmpdir} from 'node:os'
import type ts from 'typescript'

// Virtual TypeScript environment for component validation. Provides an in-memory
// file system and a `ts.LanguageService` over a hand-rolled
// `ts.LanguageServiceHost`. Faithful port of the source
// `validation/createVirtualTSEnvironment.ts`, with two deliberate CLI
// adaptations:
//   1. The TypeScript compiler is injected (`typescript` parameter) rather than
//      statically imported, so it can be lazily loaded and kept out of the CLI
//      bundle (see typescript-loader.ts).
//   2. The synthetic "package root" that anchors the injected
//      `node_modules/<pkg>/...` tree is a stable path under the OS temp dir that
//      does not exist on disk. This guarantees module resolution only ever finds
//      the injected virtual files — never a real `node_modules` that happens to
//      sit above the CLI install — so results are deterministic in dev and in
//      the bundled dist alike. (The source relied on its install layout having
//      no conflicting packages; the CLI cannot make that assumption.)

export interface VirtualTSEnvironment {
  languageService: ts.LanguageService
  servicesHost: ts.LanguageServiceHost
  fileVersions: Map<string, number>
  virtualFiles: Map<string, string>
}

interface VirtualFileSystem {
  fileVersions: Map<string, number>
  virtualFiles: Map<string, string>
}

export function getCompilerOptions(
  typescript: typeof ts,
  jsxImportSource?: string,
  packageRoot?: string,
): ts.CompilerOptions {
  return {
    target: typescript.ScriptTarget.ESNext,
    module: typescript.ModuleKind.ESNext,
    jsx: typescript.JsxEmit.ReactJSX,
    jsxImportSource: jsxImportSource ?? 'preact',
    strict: true,
    strictNullChecks: false,
    esModuleInterop: true,
    skipLibCheck: true,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    allowSyntheticDefaultImports: true,
    lib: ['es2020', 'dom'],
    allowJs: true,
    checkJs: false,
    ...(packageRoot
      ? {
          // Bundled React UI extension types reference the upstream package's
          // internal src/surfaces paths, while our extracted assets only include
          // build/ts. Teach TS to resolve those internal type-only imports
          // against the extracted build tree.
          baseUrl: packageRoot,
          paths: {
            '@shopify/ui-extensions/src/surfaces/*': ['node_modules/@shopify/ui-extensions/build/ts/surfaces/*'],
          },
        }
      : {}),
  }
}

/**
 * A stable, forward-slash absolute path used as the virtual environment's
 * package root. It intentionally does not exist on disk: every injected
 * declaration file lives under `<root>/node_modules/<pkg>/...` in memory, and
 * because the directory has no real filesystem presence, TypeScript's fallback
 * to `ts.sys` never resolves a competing real package.
 */
function syntheticPackageRoot(): string {
  return resolvePath(tmpdir(), 'shopify-cli-validate-components-vfs')
}

function getScriptSnapshot(
  typescript: typeof ts,
  fileName: string,
  virtualFiles: Map<string, string>,
): ts.IScriptSnapshot | undefined {
  const virtualContent = virtualFiles.get(fileName)
  if (virtualContent !== undefined) {
    return typescript.ScriptSnapshot.fromString(virtualContent)
  }

  try {
    const fileContent = typescript.sys.readFile(fileName)
    return fileContent ? typescript.ScriptSnapshot.fromString(fileContent) : undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

function createLanguageServiceHost(
  typescript: typeof ts,
  vfs: VirtualFileSystem,
  packageRoot: string,
  jsxImportSource?: string,
): ts.LanguageServiceHost {
  return {
    getScriptFileNames: () => Array.from(vfs.virtualFiles.keys()),
    getScriptVersion: (fileName) => vfs.fileVersions.get(fileName)?.toString() ?? '0',
    getScriptSnapshot: (fileName) => getScriptSnapshot(typescript, fileName, vfs.virtualFiles),
    getCurrentDirectory: () => packageRoot,
    getCompilationSettings: () => getCompilerOptions(typescript, jsxImportSource, packageRoot),
    getDefaultLibFileName: (options) => typescript.getDefaultLibFilePath(options),
    fileExists: (fileName) => vfs.virtualFiles.has(fileName) || typescript.sys.fileExists(fileName),
    readFile: (fileName) => vfs.virtualFiles.get(fileName) ?? typescript.sys.readFile(fileName),
    readDirectory: typescript.sys.readDirectory,
    getDirectories: typescript.sys.getDirectories,
    directoryExists: (dirName) => {
      // Make module resolution aware of the synthetic node_modules/<pkg>/...
      // paths populated from the shipped types tree. Without this, TS skips the
      // entire synthetic subtree before fileExists is ever consulted.
      const withSep = dirName.endsWith('/') ? dirName : `${dirName}/`
      for (const key of vfs.virtualFiles.keys()) {
        if (key.startsWith(withSep)) return true
      }
      return typescript.sys.directoryExists(dirName)
    },
    getNewLine: () => '\n',
  }
}

export function createVirtualTSEnvironment(
  typescript: typeof ts,
  jsxImportSource: 'react' | 'preact',
): VirtualTSEnvironment {
  const fileVersions = new Map<string, number>()
  const virtualFiles = new Map<string, string>()
  const packageRoot = syntheticPackageRoot()

  const servicesHost = createLanguageServiceHost(typescript, {fileVersions, virtualFiles}, packageRoot, jsxImportSource)

  const languageService = typescript.createLanguageService(servicesHost, typescript.createDocumentRegistry())

  // Explicitly load the TypeScript lib files into the virtual environment.
  // Without lib.es5.d.ts, utility types (Partial, Pick, etc.) are undefined,
  // which breaks resolving `extends` clauses in polaris.d.ts.
  const libDir = dirname(typescript.getDefaultLibFilePath(getCompilerOptions(typescript, jsxImportSource, packageRoot)))
  // lib.es5 provides the utility types (Partial, Pick, Required, Omit, ...),
  // lib.es2020 the ES2020 features, and lib.dom the DOM types.
  const libFileNames = ['lib.es5.d.ts', 'lib.es2020.d.ts', 'lib.dom.d.ts']

  for (const libFileName of libFileNames) {
    try {
      const libPath = joinPath(libDir, libFileName)
      const libContent = typescript.sys.readFile(libPath)
      if (libContent) {
        virtualFiles.set(libPath, libContent)
        fileVersions.set(libPath, 1)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // Lib file not accessible; the language service falls back to ts.sys.
    }
  }

  return {languageService, servicesHost, fileVersions, virtualFiles}
}

function incrementFileVersion(fileVersions: Map<string, number>, fileName: string): number {
  const newVersion = (fileVersions.get(fileName) ?? 0) + 1
  fileVersions.set(fileName, newVersion)
  return newVersion
}

export function addFileToVirtualEnv(virtualEnv: VirtualTSEnvironment, fileName: string, content: string): void {
  virtualEnv.virtualFiles.set(fileName, content)
  incrementFileVersion(virtualEnv.fileVersions, fileName)
}
