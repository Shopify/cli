import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { builtinModules } from "module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";
import { defineConfig } from "vite";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

// The generated embedded schema modules (scripts/embed-schemas.ts runs before
// the build). Each is its own entry so a single API/version can be imported via
// the `./schema-embedded/*` subpath without pulling in the rest.
const dataEmbeddedDir = fileURLToPath(
  new URL("./src/data-embedded", import.meta.url),
);
const dataEmbeddedEntries = existsSync(dataEmbeddedDir)
  ? Object.fromEntries(
      readdirSync(dataEmbeddedDir)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => [
          `data-embedded/${f.replace(/\.ts$/, "")}`,
          path.join(dataEmbeddedDir, f),
        ]),
    )
  : {};

// Custom plugin to copy data files to dist
const copyDataFiles = () => {
  return {
    name: "copy-data-files",
    closeBundle() {
      // Create dist/data directory
      mkdirSync("./dist/data", { recursive: true });

      // Copy only compressed JSON.gz files and small uncompressed config files
      const dataFiles = readdirSync("./src/data").filter(
        (file) =>
          file.endsWith(".json.gz") ||
          file === "supported-versions-schema.json",
      );
      dataFiles.forEach((file) => {
        cpSync(path.join("./src/data", file), path.join("./dist/data", file));
      });

      // Recursively copy the UI type asset tree, but ship only the compressed
      // siblings (loadTypesIntoTSEnv gunzipSync's into memory) plus the
      // index.json that maps (apiKey, apiVersion) → packages. compress-json.js
      // is the gatekeeper for what gets compressed (skipping .test.ts/.spec.ts),
      // so trusting any `.gz` here naturally covers .d.ts.gz, package.json.gz,
      // and the companion .ts.gz some packages ship (e.g. @shopify/app-bridge-types).
      const typesSrc = "./src/data/types";
      const typesDst = "./dist/data/types";
      if (existsSync(typesSrc)) {
        cpSync(typesSrc, typesDst, {
          recursive: true,
          filter: (src) => {
            const stat = statSync(src);
            if (stat.isDirectory()) return true;
            return src.endsWith(".gz") || src.endsWith("index.json");
          },
        });
      }
    },
  };
};

// Custom plugin to selectively minify files
const selectiveMinify = () => {
  return {
    name: "selective-minify",
    enforce: "post",
    async generateBundle(options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;

        try {
          const result = await minify(chunk.code, {
            compress: true,
            mangle: true,
            format: {
              comments: false,
            },
          });

          if (result.code) {
            chunk.code = result.code;
          }
        } catch (error) {
          console.error(`Failed to minify ${fileName}:`, error);
        }
      }
    },
  };
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
        "schemaOperations/index": fileURLToPath(
          new URL("./src/schemaOperations/index.ts", import.meta.url),
        ),
        "introspection/index": fileURLToPath(
          new URL("./src/introspection/index.ts", import.meta.url),
        ),
        "validation/index": fileURLToPath(
          new URL("./src/validation/index.ts", import.meta.url),
        ),
        "validation/graphql": fileURLToPath(
          new URL("./src/validation/graphql.ts", import.meta.url),
        ),
        "schema-embedded": fileURLToPath(
          new URL("./src/schema-embedded.ts", import.meta.url),
        ),
        ...dataEmbeddedEntries,
        "types/index": fileURLToPath(
          new URL("./src/types/index.ts", import.meta.url),
        ),
        "types/api-mapping": fileURLToPath(
          new URL("./src/types/api-mapping.ts", import.meta.url),
        ),
        "types/api-types": fileURLToPath(
          new URL("./src/types/api-types.ts", import.meta.url),
        ),
        "http/index": fileURLToPath(
          new URL("./src/http/index.ts", import.meta.url),
        ),
        "experiments/index": fileURLToPath(
          new URL("./src/experiments/index.ts", import.meta.url),
        ),
        "internal/index": fileURLToPath(
          new URL("./src/internal/index.ts", import.meta.url),
        ),
        "internal/api-mapping": fileURLToPath(
          new URL("./src/internal/api-mapping.ts", import.meta.url),
        ),
        "config/api-mappings": fileURLToPath(
          new URL("./src/config/api-mappings.ts", import.meta.url),
        ),
      },
      formats: ["esm"],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    outDir: "dist",
    emptyOutDir: true,
    // Disable Vite's built-in minification
    minify: false,
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        "graphql",
        "typescript",
        "html-tags",
      ],
      output: {
        interop: "auto",
        preserveModules: false,
      },
      plugins: [
        selectiveMinify(), // Apply selective minification
        copyDataFiles(), // Copy data files to dist
      ],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
    },
    alias: {
      // Similar to the moduleNameMapper in Jest config
      "^(\\.{1,2}/.*)\\.js$": "$1",
    },
  },
});
