import ts from "typescript";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addFileToVirtualEnv,
  getCompilerOptions,
  createVirtualTSEnvironment,
  type VirtualTSEnvironment,
} from "./createVirtualTSEnvironment";

describe("virtualTSEnvironment", () => {
  describe("createVirtualTSEnvironment", () => {
    it("creates a virtual TypeScript environment with required properties", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");

      expect(env).toHaveProperty("languageService");
      expect(env).toHaveProperty("servicesHost");
      expect(env).toHaveProperty("fileVersions");
      expect(env).toHaveProperty("virtualFiles");
      expect(env.languageService).toBeDefined();
      expect(env.servicesHost).toBeDefined();
      expect(env.fileVersions).toBeInstanceOf(Map);
      expect(env.virtualFiles).toBeInstanceOf(Map);
    });

    it("creates an environment with TypeScript lib files preloaded", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");

      // TypeScript lib files are preloaded for utility types support
      expect(env.fileVersions.size).toStrictEqual(3);
      expect(env.virtualFiles.size).toStrictEqual(3);
      expect(env.servicesHost.getScriptFileNames()).toHaveLength(3);

      // Verify lib files are loaded
      const fileNames = env.servicesHost.getScriptFileNames();
      expect(fileNames.some((f) => f.includes("lib.es5.d.ts"))).toStrictEqual(
        true,
      );
      expect(
        fileNames.some((f) => f.includes("lib.es2020.d.ts")),
      ).toStrictEqual(true);
      expect(fileNames.some((f) => f.includes("lib.dom.d.ts"))).toStrictEqual(
        true,
      );
    });

    it("provides correct compiler options", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");

      const settings = env.servicesHost.getCompilationSettings();
      expect(settings).toStrictEqual(
        getCompilerOptions(undefined, env.servicesHost.getCurrentDirectory()),
      );
    });

    it("maps upstream ui-extensions source surface imports to bundled build types", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");

      const settings = env.servicesHost.getCompilationSettings();
      expect(settings.baseUrl).toStrictEqual(
        env.servicesHost.getCurrentDirectory(),
      );
      expect(settings.paths).toStrictEqual({
        "@shopify/ui-extensions/src/surfaces/*": [
          "node_modules/@shopify/ui-extensions/build/ts/surfaces/*",
        ],
      });
    });

    it("returns correct script version for files", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      addFileToVirtualEnv(env, "test.ts", "const x = 1;");

      expect(env.servicesHost.getScriptVersion("test.ts")).toStrictEqual("1");
      expect(env.servicesHost.getScriptVersion("nonexistent.ts")).toStrictEqual(
        "0",
      );
    });
  });

  describe("addFileToVirtualEnv", () => {
    let env: VirtualTSEnvironment;

    beforeEach(() => {
      env = createVirtualTSEnvironment("polaris-app-home");
    });

    it("adds a file to the virtual environment", () => {
      const fileName = "test.ts";
      const content = "const x: number = 42;";

      addFileToVirtualEnv(env, fileName, content);

      expect(env.virtualFiles.has(fileName)).toStrictEqual(true);
      expect(env.virtualFiles.get(fileName)).toStrictEqual(content);
      expect(env.fileVersions.has(fileName)).toStrictEqual(true);
      expect(env.fileVersions.get(fileName)).toStrictEqual(1);
    });

    it("increments version when updating existing file", () => {
      const fileName = "test.ts";

      addFileToVirtualEnv(env, fileName, "const x = 1;");
      expect(env.fileVersions.get(fileName)).toStrictEqual(1);

      addFileToVirtualEnv(env, fileName, "const x = 2;");
      expect(env.fileVersions.get(fileName)).toStrictEqual(2);

      addFileToVirtualEnv(env, fileName, "const x = 3;");
      expect(env.fileVersions.get(fileName)).toStrictEqual(3);
    });

    it("makes file available to language service", () => {
      const fileName = "test.ts";
      const content = "const x: number = 42;";

      addFileToVirtualEnv(env, fileName, content);

      const fileNames = env.servicesHost.getScriptFileNames();
      // Should include the test file plus the 3 preloaded lib files
      expect(fileNames).toContain(fileName);
      expect(fileNames.length).toStrictEqual(4);

      const snapshot = env.servicesHost.getScriptSnapshot(fileName);
      expect(snapshot).toBeDefined();
      expect(snapshot!.getText(0, snapshot!.getLength())).toStrictEqual(
        content,
      );
    });

    it("handles multiple files", () => {
      addFileToVirtualEnv(env, "file1.ts", "const a = 1;");
      addFileToVirtualEnv(env, "file2.ts", "const b = 2;");
      addFileToVirtualEnv(env, "file3.ts", "const c = 3;");

      // Should have 3 user files + 3 preloaded lib files = 6 total
      expect(env.virtualFiles.size).toStrictEqual(6);
      expect(env.fileVersions.size).toStrictEqual(6);
      expect(env.servicesHost.getScriptFileNames()).toHaveLength(6);
    });
  });

  describe("COMPILER_OPTIONS", () => {
    it("has correct TypeScript configuration", () => {
      expect(getCompilerOptions().target).toStrictEqual(ts.ScriptTarget.ESNext);
      expect(getCompilerOptions().module).toStrictEqual(ts.ModuleKind.ESNext);
      expect(getCompilerOptions().jsx).toStrictEqual(ts.JsxEmit.ReactJSX);
      expect(getCompilerOptions().jsxImportSource).toStrictEqual("preact");
      expect(getCompilerOptions().strict).toStrictEqual(true);
      expect(getCompilerOptions().esModuleInterop).toStrictEqual(true);
      expect(getCompilerOptions().skipLibCheck).toStrictEqual(true);
      expect(getCompilerOptions().moduleResolution).toStrictEqual(
        ts.ModuleResolutionKind.NodeJs,
      );
      expect(getCompilerOptions().allowSyntheticDefaultImports).toStrictEqual(
        true,
      );
      expect(getCompilerOptions().allowJs).toStrictEqual(true);
      expect(getCompilerOptions().checkJs).toStrictEqual(false);
    });

    it("provides correct jsxImportSource", () => {
      expect(getCompilerOptions("react").jsxImportSource).toStrictEqual(
        "react",
      );
      expect(getCompilerOptions("preact").jsxImportSource).toStrictEqual(
        "preact",
      );
      expect(getCompilerOptions("solid-js").jsxImportSource).toStrictEqual(
        "solid-js",
      );
      expect(getCompilerOptions("vue").jsxImportSource).toStrictEqual("vue");
      expect(getCompilerOptions("svelte").jsxImportSource).toStrictEqual(
        "svelte",
      );
      expect(getCompilerOptions("lit").jsxImportSource).toStrictEqual("lit");
      expect(getCompilerOptions("angular").jsxImportSource).toStrictEqual(
        "angular",
      );
      expect(getCompilerOptions("riot").jsxImportSource).toStrictEqual("riot");
    });

    it("includes required lib files", () => {
      expect(getCompilerOptions().lib).toStrictEqual(["es2020", "dom"]);
    });
  });

  describe("servicesHost functionality", () => {
    it("correctly reports file existence", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const fileName = "test.ts";

      expect(env.servicesHost.fileExists(fileName)).toStrictEqual(false);

      addFileToVirtualEnv(env, fileName, "const x = 1;");

      expect(env.servicesHost.fileExists(fileName)).toStrictEqual(true);
    });

    it("correctly reads file content", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const fileName = "test.ts";
      const content = "export const value = 42;";

      addFileToVirtualEnv(env, fileName, content);

      expect(env.servicesHost.readFile(fileName)).toStrictEqual(content);
    });

    it("returns consistent new line character", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      expect(env.servicesHost.getNewLine!()).toStrictEqual("\n");
    });

    it("provides TypeScript lib file path", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const libPath =
        env.servicesHost.getDefaultLibFileName(getCompilerOptions());

      expect(typeof libPath).toStrictEqual("string");
      expect(libPath.length).toBeGreaterThan(0);
      expect(libPath).toMatch(/lib.*\.d\.ts$/);
    });

    it("returns undefined for non-existent file snapshot", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const snapshot = env.servicesHost.getScriptSnapshot("non-existent.ts");

      expect(snapshot).toBeUndefined();
    });

    it("handles readFile for non-existent files", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const content = env.servicesHost.readFile("non-existent.ts");

      expect(content).toBeUndefined();
    });

    it("maintains current directory", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const currentDir = env.servicesHost.getCurrentDirectory();

      expect(typeof currentDir).toStrictEqual("string");
      expect(currentDir.length).toBeGreaterThan(0);
      expect(currentDir).toMatch(/shopify-dev-tools[/\\]src$/);
    });
  });

  describe("TypeScript integration", () => {
    it("can perform semantic analysis on added files", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const fileName = "test.ts";
      const content = `
        const x: number = "not a number"; // Type error
        export { x };
      `;

      addFileToVirtualEnv(env, fileName, content);

      const diagnostics = env.languageService.getSemanticDiagnostics(fileName);
      expect(diagnostics.length).toStrictEqual(1);
      expect(diagnostics[0].code).toStrictEqual(2322);
    });

    it("can handle JSX/TSX files", () => {
      const env = createVirtualTSEnvironment("polaris-app-home");
      const fileName = "component.tsx";
      const content = `
        const Component = () => {
          return <div>Hello</div>;
        };
        export default Component;
      `;

      addFileToVirtualEnv(env, fileName, content);

      const diagnostics = env.languageService.getSyntacticDiagnostics(fileName);
      expect(diagnostics.length).toStrictEqual(0);
    });
  });

  describe("Hydrogen", () => {
    it("creates a virtual TypeScript environment with required properties", () => {
      const env = createVirtualTSEnvironment("hydrogen");

      expect(env).toHaveProperty("languageService");
      expect(env).toHaveProperty("servicesHost");
      expect(env).toHaveProperty("fileVersions");
      expect(env).toHaveProperty("virtualFiles");
      expect(
        env.servicesHost.getCompilationSettings().jsxImportSource,
      ).toStrictEqual("react");
    });
  });
});
