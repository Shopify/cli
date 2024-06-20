// ../../configurations/vite.config.ts
import * as path from "file:///Users/isaac/src/github.com/Shopify/cli/node_modules/.pnpm/pathe@1.1.1/node_modules/pathe/dist/index.mjs";
import { defineConfig } from "file:///Users/isaac/src/github.com/Shopify/cli/node_modules/.pnpm/vitest@1.6.0_@types+node@18.19.3_jsdom@20.0.3/node_modules/vitest/dist/config.js";
var __vite_injected_original_dirname = "/Users/isaac/src/github.com/Shopify/cli/configurations";
var TIMEOUTS = {
  normal: 5e3,
  windows: 13e3,
  macos: 13e3,
  debug: 18e4
};
function config(packagePath) {
  process.env["FORCE_HYPERLINK"] = "0";
  process.env["FORCE_COLOR"] = "1";
  let testTimeout = TIMEOUTS.normal;
  if (process.env["VITEST_SKIP_TIMEOUT"] === "1") {
    testTimeout = TIMEOUTS.debug;
  } else if (process.env["RUNNER_OS"] === "Windows") {
    testTimeout = TIMEOUTS.windows;
  } else if (process.env["RUNNER_OS"] === "macOS") {
    testTimeout = TIMEOUTS.macos;
  }
  return defineConfig({
    resolve: {
      alias: aliases(packagePath)
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    test: {
      testTimeout,
      clearMocks: true,
      mockReset: true,
      setupFiles: [path.join(__vite_injected_original_dirname, "./vitest/setup.js")],
      reporters: ["verbose", "hanging-process"],
      threads: false,
      coverage: {
        provider: "istanbul",
        include: ["**/src/**"],
        all: true,
        reporter: ["text", "json", "lcov"]
      },
      snapshotFormat: {
        escapeString: true
      }
    }
  });
}
var aliases = (packagePath) => {
  return [
    {
      find: /@shopify\/cli-kit\/(.+)/,
      replacement: (importedModule) => {
        return path.join(packagePath, `../cli-kit/src/public/${importedModule.replace("@shopify/cli-kit/", "")}`);
      }
    },
    { find: "@shopify/cli-kit", replacement: path.join(packagePath, "../cli-kit/src/index") }
  ];
};

// vite.config.ts
var __vite_injected_original_dirname2 = "/Users/isaac/src/github.com/Shopify/cli/packages/theme";
var vite_config_default = config(__vite_injected_original_dirname2);
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vY29uZmlndXJhdGlvbnMvdml0ZS5jb25maWcudHMiLCAidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaXNhYWMvc3JjL2dpdGh1Yi5jb20vU2hvcGlmeS9jbGkvY29uZmlndXJhdGlvbnNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9pc2FhYy9zcmMvZ2l0aHViLmNvbS9TaG9waWZ5L2NsaS9jb25maWd1cmF0aW9ucy92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvaXNhYWMvc3JjL2dpdGh1Yi5jb20vU2hvcGlmeS9jbGkvY29uZmlndXJhdGlvbnMvdml0ZS5jb25maWcudHNcIjsvKiBlc2xpbnQtZGlzYWJsZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXMgKi9cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuLy8gQHRzLWlnbm9yZVxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoZSdcbmltcG9ydCB7ZGVmaW5lQ29uZmlnfSBmcm9tICd2aXRlc3QvY29uZmlnJ1xuXG5jb25zdCBUSU1FT1VUUyA9IHtcbiAgbm9ybWFsOiA1MDAwLFxuICB3aW5kb3dzOiAxMzAwMCxcbiAgbWFjb3M6IDEzMDAwLFxuICBkZWJ1ZzogMTgwMDAwLFxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjb25maWcocGFja2FnZVBhdGg6IHN0cmluZykge1xuICAvLyBhbHdheXMgdHJlYXQgZW52aXJvbm1lbnQgYXMgb25lIHRoYXQgZG9lc24ndCBzdXBwb3J0IGh5cGVybGlua3MgLS0gb3RoZXJ3aXNlIGFzc2VydGlvbnMgYXJlIGhhcmQgdG8ga2VlcCBjb25zaXN0ZW50XG4gIHByb2Nlc3MuZW52WydGT1JDRV9IWVBFUkxJTksnXSA9ICcwJ1xuICBwcm9jZXNzLmVudlsnRk9SQ0VfQ09MT1InXSA9ICcxJ1xuXG4gIGxldCB0ZXN0VGltZW91dCA9IFRJTUVPVVRTLm5vcm1hbFxuICBpZiAocHJvY2Vzcy5lbnZbJ1ZJVEVTVF9TS0lQX1RJTUVPVVQnXSA9PT0gJzEnKSB7XG4gICAgdGVzdFRpbWVvdXQgPSBUSU1FT1VUUy5kZWJ1Z1xuICB9IGVsc2UgaWYgKHByb2Nlc3MuZW52WydSVU5ORVJfT1MnXSA9PT0gJ1dpbmRvd3MnKSB7XG4gICAgdGVzdFRpbWVvdXQgPSBUSU1FT1VUUy53aW5kb3dzXG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnZbJ1JVTk5FUl9PUyddID09PSAnbWFjT1MnKSB7XG4gICAgdGVzdFRpbWVvdXQgPSBUSU1FT1VUUy5tYWNvc1xuICB9XG5cbiAgcmV0dXJuIGRlZmluZUNvbmZpZyh7XG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IGFsaWFzZXMocGFja2FnZVBhdGgpLFxuICAgIH0sXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB0ZXN0OiB7XG4gICAgICB0ZXN0VGltZW91dCxcbiAgICAgIGNsZWFyTW9ja3M6IHRydWUsXG4gICAgICBtb2NrUmVzZXQ6IHRydWUsXG4gICAgICBzZXR1cEZpbGVzOiBbcGF0aC5qb2luKF9fZGlybmFtZSwgJy4vdml0ZXN0L3NldHVwLmpzJyldLFxuICAgICAgcmVwb3J0ZXJzOiBbJ3ZlcmJvc2UnLCAnaGFuZ2luZy1wcm9jZXNzJ10sXG4gICAgICB0aHJlYWRzOiBmYWxzZSxcbiAgICAgIGNvdmVyYWdlOiB7XG4gICAgICAgIHByb3ZpZGVyOiAnaXN0YW5idWwnLFxuICAgICAgICBpbmNsdWRlOiBbJyoqL3NyYy8qKiddLFxuICAgICAgICBhbGw6IHRydWUsXG4gICAgICAgIHJlcG9ydGVyOiBbJ3RleHQnLCAnanNvbicsICdsY292J10sXG4gICAgICB9LFxuICAgICAgc25hcHNob3RGb3JtYXQ6IHtcbiAgICAgICAgZXNjYXBlU3RyaW5nOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9KVxufVxuXG5leHBvcnQgY29uc3QgYWxpYXNlcyA9IChwYWNrYWdlUGF0aDogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBbXG4gICAge1xuICAgICAgZmluZDogL0BzaG9waWZ5XFwvY2xpLWtpdFxcLyguKykvLFxuICAgICAgcmVwbGFjZW1lbnQ6IChpbXBvcnRlZE1vZHVsZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4ocGFja2FnZVBhdGgsIGAuLi9jbGkta2l0L3NyYy9wdWJsaWMvJHtpbXBvcnRlZE1vZHVsZS5yZXBsYWNlKCdAc2hvcGlmeS9jbGkta2l0LycsICcnKX1gKVxuICAgICAgfSxcbiAgICB9LFxuICAgIHtmaW5kOiAnQHNob3BpZnkvY2xpLWtpdCcsIHJlcGxhY2VtZW50OiBwYXRoLmpvaW4ocGFja2FnZVBhdGgsICcuLi9jbGkta2l0L3NyYy9pbmRleCcpfSxcbiAgXVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvaXNhYWMvc3JjL2dpdGh1Yi5jb20vU2hvcGlmeS9jbGkvcGFja2FnZXMvdGhlbWVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9pc2FhYy9zcmMvZ2l0aHViLmNvbS9TaG9waWZ5L2NsaS9wYWNrYWdlcy90aGVtZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvaXNhYWMvc3JjL2dpdGh1Yi5jb20vU2hvcGlmeS9jbGkvcGFja2FnZXMvdGhlbWUvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgY29uZmlnIGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb25zL3ZpdGUuY29uZmlnJ1xuXG5leHBvcnQgZGVmYXVsdCBjb25maWcoX19kaXJuYW1lKVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUlBLFlBQVksVUFBVTtBQUN0QixTQUFRLG9CQUFtQjtBQUwzQixJQUFNLG1DQUFtQztBQU96QyxJQUFNLFdBQVc7QUFBQSxFQUNmLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFBQSxFQUNULE9BQU87QUFBQSxFQUNQLE9BQU87QUFDVDtBQUVlLFNBQVIsT0FBd0IsYUFBcUI7QUFFbEQsVUFBUSxJQUFJLGlCQUFpQixJQUFJO0FBQ2pDLFVBQVEsSUFBSSxhQUFhLElBQUk7QUFFN0IsTUFBSSxjQUFjLFNBQVM7QUFDM0IsTUFBSSxRQUFRLElBQUkscUJBQXFCLE1BQU0sS0FBSztBQUM5QyxrQkFBYyxTQUFTO0FBQUEsRUFDekIsV0FBVyxRQUFRLElBQUksV0FBVyxNQUFNLFdBQVc7QUFDakQsa0JBQWMsU0FBUztBQUFBLEVBQ3pCLFdBQVcsUUFBUSxJQUFJLFdBQVcsTUFBTSxTQUFTO0FBQy9DLGtCQUFjLFNBQVM7QUFBQSxFQUN6QjtBQUVBLFNBQU8sYUFBYTtBQUFBLElBQ2xCLFNBQVM7QUFBQSxNQUNQLE9BQU8sUUFBUSxXQUFXO0FBQUEsSUFDNUI7QUFBQTtBQUFBO0FBQUEsSUFHQSxNQUFNO0FBQUEsTUFDSjtBQUFBLE1BQ0EsWUFBWTtBQUFBLE1BQ1osV0FBVztBQUFBLE1BQ1gsWUFBWSxDQUFNLFVBQUssa0NBQVcsbUJBQW1CLENBQUM7QUFBQSxNQUN0RCxXQUFXLENBQUMsV0FBVyxpQkFBaUI7QUFBQSxNQUN4QyxTQUFTO0FBQUEsTUFDVCxVQUFVO0FBQUEsUUFDUixVQUFVO0FBQUEsUUFDVixTQUFTLENBQUMsV0FBVztBQUFBLFFBQ3JCLEtBQUs7QUFBQSxRQUNMLFVBQVUsQ0FBQyxRQUFRLFFBQVEsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNkLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGLENBQUM7QUFDSDtBQUVPLElBQU0sVUFBVSxDQUFDLGdCQUF3QjtBQUM5QyxTQUFPO0FBQUEsSUFDTDtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sYUFBYSxDQUFDLG1CQUEyQjtBQUN2QyxlQUFZLFVBQUssYUFBYSx5QkFBeUIsZUFBZSxRQUFRLHFCQUFxQixFQUFFLENBQUMsRUFBRTtBQUFBLE1BQzFHO0FBQUEsSUFDRjtBQUFBLElBQ0EsRUFBQyxNQUFNLG9CQUFvQixhQUFrQixVQUFLLGFBQWEsc0JBQXNCLEVBQUM7QUFBQSxFQUN4RjtBQUNGOzs7QUNoRUEsSUFBTUEsb0NBQW1DO0FBRXpDLElBQU8sc0JBQVEsT0FBT0MsaUNBQVM7IiwKICAibmFtZXMiOiBbIl9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lIiwgIl9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lIl0KfQo=
