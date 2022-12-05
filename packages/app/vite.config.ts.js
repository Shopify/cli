// ../../configurations/vite.config.ts
import path from "pathe";
import { defineConfig } from "vite";
function config(packagePath) {
  return defineConfig({
    resolve: {
      alias: aliases(packagePath)
    },
    test: {
      clearMocks: true,
      mockReset: true,
      setupFiles: [path.join("/Users/pepicrft/src/github.com/Shopify/cli/configurations", "./vitest/setup.js")],
      threads: false
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
var vite_config_default = config("/Users/pepicrft/src/github.com/Shopify/cli/packages/app");
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vY29uZmlndXJhdGlvbnMvdml0ZS5jb25maWcudHMiLCAidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qIGVzbGludC1kaXNhYmxlIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llcyAqL1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoZSdcbmltcG9ydCB7ZGVmaW5lQ29uZmlnfSBmcm9tICd2aXRlJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjb25maWcocGFja2FnZVBhdGg6IHN0cmluZykge1xuICByZXR1cm4gZGVmaW5lQ29uZmlnKHtcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczogYWxpYXNlcyhwYWNrYWdlUGF0aCksXG4gICAgfSxcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHRlc3Q6IHtcbiAgICAgIGNsZWFyTW9ja3M6IHRydWUsXG4gICAgICBtb2NrUmVzZXQ6IHRydWUsXG4gICAgICBzZXR1cEZpbGVzOiBbcGF0aC5qb2luKFwiL1VzZXJzL3BlcGljcmZ0L3NyYy9naXRodWIuY29tL1Nob3BpZnkvY2xpL2NvbmZpZ3VyYXRpb25zXCIsICcuL3ZpdGVzdC9zZXR1cC5qcycpXSxcbiAgICAgIHRocmVhZHM6IGZhbHNlLFxuICAgIH0sXG4gIH0pXG59XG5cbmV4cG9ydCBjb25zdCBhbGlhc2VzID0gKHBhY2thZ2VQYXRoOiBzdHJpbmcpID0+IHtcbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBmaW5kOiAvQHNob3BpZnlcXC9jbGkta2l0XFwvKC4rKS8sXG4gICAgICByZXBsYWNlbWVudDogKGltcG9ydGVkTW9kdWxlOiBzdHJpbmcpID0+IHtcbiAgICAgICAgcmV0dXJuIHBhdGguam9pbihwYWNrYWdlUGF0aCwgYC4uL2NsaS1raXQvc3JjL3B1YmxpYy8ke2ltcG9ydGVkTW9kdWxlLnJlcGxhY2UoJ0BzaG9waWZ5L2NsaS1raXQvJywgJycpfWApXG4gICAgICB9LFxuICAgIH0sXG4gICAge2ZpbmQ6ICdAc2hvcGlmeS9jbGkta2l0JywgcmVwbGFjZW1lbnQ6IHBhdGguam9pbihwYWNrYWdlUGF0aCwgJy4uL2NsaS1raXQvc3JjL2luZGV4Jyl9LFxuICBdXG59XG4iLCAiaW1wb3J0IGNvbmZpZyBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9ucy92aXRlLmNvbmZpZydcblxuZXhwb3J0IGRlZmF1bHQgY29uZmlnKFwiL1VzZXJzL3BlcGljcmZ0L3NyYy9naXRodWIuY29tL1Nob3BpZnkvY2xpL3BhY2thZ2VzL2FwcFwiKVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUlBLE9BQU8sVUFBVTtBQUNqQixTQUFRLG9CQUFtQjtBQUVaLFNBQVIsT0FBd0IsYUFBcUI7QUFDbEQsU0FBTyxhQUFhO0FBQUEsSUFDbEIsU0FBUztBQUFBLE1BQ1AsT0FBTyxRQUFRLFdBQVc7QUFBQSxJQUM1QjtBQUFBLElBR0EsTUFBTTtBQUFBLE1BQ0osWUFBWTtBQUFBLE1BQ1osV0FBVztBQUFBLE1BQ1gsWUFBWSxDQUFDLEtBQUssS0FBSyw2REFBNkQsbUJBQW1CLENBQUM7QUFBQSxNQUN4RyxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0YsQ0FBQztBQUNIO0FBRU8sSUFBTSxVQUFVLENBQUMsZ0JBQXdCO0FBQzlDLFNBQU87QUFBQSxJQUNMO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixhQUFhLENBQUMsbUJBQTJCO0FBQ3ZDLGVBQU8sS0FBSyxLQUFLLGFBQWEseUJBQXlCLGVBQWUsUUFBUSxxQkFBcUIsRUFBRSxHQUFHO0FBQUEsTUFDMUc7QUFBQSxJQUNGO0FBQUEsSUFDQSxFQUFDLE1BQU0sb0JBQW9CLGFBQWEsS0FBSyxLQUFLLGFBQWEsc0JBQXNCLEVBQUM7QUFBQSxFQUN4RjtBQUNGOzs7QUMvQkEsSUFBTyxzQkFBUSxPQUFPLHlEQUF5RDsiLAogICJuYW1lcyI6IFtdCn0K
