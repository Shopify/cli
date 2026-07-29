/**
 * Virtual TypeScript Environment for component validation
 * Provides a virtual file system and TypeScript language service
 */

import * as path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";
import type { ShopifyAPIs } from "../types/api-mapping";

export interface VirtualTSEnvironment {
  languageService: ts.LanguageService;
  servicesHost: ts.LanguageServiceHost;
  fileVersions: Map<string, number>;
  virtualFiles: Map<string, string>;
}

interface VirtualFileSystem {
  fileVersions: Map<string, number>;
  virtualFiles: Map<string, string>;
}

export const getCompilerOptions = (
  jsxImportSource?: string,
  packageRoot?: string,
): ts.CompilerOptions => ({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  jsxImportSource: jsxImportSource || "preact",
  strict: true,
  strictNullChecks: false,
  esModuleInterop: true,
  skipLibCheck: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  allowSyntheticDefaultImports: true,
  lib: ["es2020", "dom"],
  allowJs: true,
  checkJs: false,
  ...(packageRoot
    ? {
        // Bundled React UI extension types reference the upstream package's
        // internal src/surfaces paths, while our extracted assets only include
        // build/ts. Keep the assets unchanged and teach TS to resolve those
        // internal type-only imports against the extracted build tree.
        baseUrl: packageRoot,
        paths: {
          "@shopify/ui-extensions/src/surfaces/*": [
            "node_modules/@shopify/ui-extensions/build/ts/surfaces/*",
          ],
        },
      }
    : {}),
});

function getPackageRoot(): string {
  const currentDir = fileURLToPath(import.meta.url);
  return path.resolve(currentDir, "../..");
}

function getScriptSnapshot(
  fileName: string,
  virtualFiles: Map<string, string>,
): ts.IScriptSnapshot | undefined {
  const virtualContent = virtualFiles.get(fileName);
  if (virtualContent) {
    return ts.ScriptSnapshot.fromString(virtualContent);
  }

  try {
    const fileContent = ts.sys.readFile(fileName);
    return fileContent ? ts.ScriptSnapshot.fromString(fileContent) : undefined;
  } catch {
    return undefined;
  }
}

function createLanguageServiceHost(
  vfs: VirtualFileSystem,
  packageRoot: string,
  jsxImportSource?: string,
): ts.LanguageServiceHost {
  return {
    getScriptFileNames: () => Array.from(vfs.virtualFiles.keys()),
    getScriptVersion: (fileName) =>
      vfs.fileVersions.get(fileName)?.toString() || "0",
    getScriptSnapshot: (fileName) =>
      getScriptSnapshot(fileName, vfs.virtualFiles),
    getCurrentDirectory: () => packageRoot,
    getCompilationSettings: () =>
      getCompilerOptions(jsxImportSource, packageRoot),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (fileName) =>
      vfs.virtualFiles.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) =>
      vfs.virtualFiles.get(fileName) || ts.sys.readFile(fileName),
    readDirectory: ts.sys.readDirectory,
    getDirectories: ts.sys.getDirectories,
    directoryExists: (dirName) => {
      // Make module resolution aware of synthetic node_modules/<pkg>/...
      // paths populated from the shipped types tree. Without this, TS skips
      // the entire synthetic subtree before fileExists is ever consulted.
      const withSep = dirName.endsWith(path.sep) ? dirName : dirName + path.sep;
      for (const key of vfs.virtualFiles.keys()) {
        if (key.startsWith(withSep)) return true;
      }
      return ts.sys.directoryExists(dirName);
    },
    getNewLine: () => "\n",
  };
}

export function createVirtualTSEnvironment(
  apiName: ShopifyAPIs,
  jsxImportSourceOverride?: "react" | "preact",
): VirtualTSEnvironment {
  const fileVersions = new Map<string, number>();
  const virtualFiles = new Map<string, string>();
  const packageRoot = getPackageRoot();
  const jsxImportSource =
    jsxImportSourceOverride ??
    (apiName === ("hydrogen" satisfies ShopifyAPIs) ? "react" : "preact");

  const servicesHost = createLanguageServiceHost(
    { fileVersions, virtualFiles },
    packageRoot,
    jsxImportSource,
  );

  const languageService = ts.createLanguageService(
    servicesHost,
    ts.createDocumentRegistry(),
  );

  // Explicitly load TypeScript lib files into virtual environment
  // Without lib.es5.d.ts, utility types (Partial, Pick, etc.) are undefined
  // This is critical for resolving extends clauses in polaris.d.ts
  const libDir = path.dirname(
    ts.getDefaultLibFilePath(getCompilerOptions(jsxImportSource, packageRoot)),
  );
  const libFileNames = [
    "lib.es5.d.ts", // Essential: Contains Partial, Pick, Required, Omit, etc.
    "lib.es2020.d.ts", // ES2020 features
    "lib.dom.d.ts", // DOM types
  ];

  for (const libFileName of libFileNames) {
    try {
      const libPath = path.join(libDir, libFileName);
      const libContent = ts.sys.readFile(libPath);
      if (libContent) {
        virtualFiles.set(libPath, libContent);
        fileVersions.set(libPath, 1);
      }
    } catch {
      // Lib file not accessible, language service will fall back to ts.sys
    }
  }

  return {
    languageService,
    servicesHost,
    fileVersions,
    virtualFiles,
  };
}

function incrementFileVersion(
  fileVersions: Map<string, number>,
  fileName: string,
): number {
  const currentVersion = fileVersions.get(fileName) || 0;
  const newVersion = currentVersion + 1;
  fileVersions.set(fileName, newVersion);
  return newVersion;
}

export function addFileToVirtualEnv(
  virtualEnv: VirtualTSEnvironment,
  fileName: string,
  content: string,
): void {
  virtualEnv.virtualFiles.set(fileName, content);
  incrementFileVersion(virtualEnv.fileVersions, fileName);
}
