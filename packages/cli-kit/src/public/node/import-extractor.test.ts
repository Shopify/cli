import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {extractImportPaths, extractImportPathsRecursively} from './import-extractor.js'
import {describe, test, expect} from 'vitest'

describe('extractImportPaths', () => {
  describe('JavaScript imports', () => {
    test('extracts ES6 imports', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.js')
        const utilsFile = joinPath(tmpDir, 'utils.js')
        const helpersFile = joinPath(tmpDir, 'helpers.js')

        await writeFile(utilsFile, 'export const foo = "bar"')
        await writeFile(helpersFile, 'export const helper = () => {}')
        await writeFile(
          mainFile,
          `
          import { foo } from './utils.js'
          import * as helpers from './helpers'
          import defaultExport from './utils'

          console.log(foo)
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(utilsFile)
        expect(imports).toContain(helpersFile)
      })
    })

    test('extracts CommonJS requires', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.js')
        const utilsFile = joinPath(tmpDir, 'utils.js')

        await writeFile(utilsFile, 'module.exports = {}')
        await writeFile(
          mainFile,
          `
          const utils = require('./utils')
          const path = require('path')

          console.log(utils)
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(utilsFile)
        // Built-in modules should not be included
        expect(imports).not.toContain('path')
      })
    })

    test('ignores non-existent files', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.js')

        await writeFile(
          mainFile,
          `
          import { foo } from './non-existent.js'
          const utils = require('./missing')
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toHaveLength(0)
      })
    })
  })

  describe('TypeScript imports', () => {
    test('extracts TypeScript imports with various extensions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.ts')
        const utilsFile = joinPath(tmpDir, 'utils.ts')
        const helperFile = joinPath(tmpDir, 'helper.js')

        await writeFile(utilsFile, 'export const foo = "bar"')
        await writeFile(helperFile, 'export const helper = () => {}')
        await writeFile(
          mainFile,
          `
          import { foo } from './utils'
          import { helper } from './helper.js'

          console.log(foo, helper)
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(utilsFile)
        expect(imports).toContain(helperFile)
      })
    })

    test('extracts imports from directories', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.ts')
        const utilsDir = joinPath(tmpDir, 'utils')
        const utilsIndex = joinPath(utilsDir, 'index.ts')

        await mkdir(utilsDir)
        await writeFile(utilsIndex, 'export default {}')
        await writeFile(
          mainFile,
          `
          import utils from './utils'
        `,
        )

        const imports = extractImportPaths(mainFile)
        // The import extractor resolves './utils' to the directory path
        expect(imports).toHaveLength(1)
        expect(imports[0]).toBe(utilsDir)
      })
    })
  })

  describe('Rust imports', () => {
    test('extracts module declarations', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.rs')
        const utilsFile = joinPath(tmpDir, 'utils.rs')
        const helpersFile = joinPath(tmpDir, 'helpers.rs')
        const nestedDir = joinPath(tmpDir, 'nested')
        const nestedModFile = joinPath(nestedDir, 'mod.rs')

        await writeFile(utilsFile, 'pub fn util_function() {}')
        await writeFile(helpersFile, 'pub fn helper_function() {}')
        await mkdir(nestedDir)
        await writeFile(nestedModFile, 'pub fn nested_function() {}')
        await writeFile(
          mainFile,
          `
          mod utils;
          mod helpers;
          mod nested;

          fn main() {
              utils::util_function();
          }
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(utilsFile)
        expect(imports).toContain(helpersFile)
        expect(imports).toContain(nestedModFile)
      })
    })

    test('extracts #[path] attributes', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.rs')
        const constantsFile = joinPath(tmpDir, 'constants.rs')
        const sharedDir = joinPath(tmpDir, 'shared')
        const sharedConstantsFile = joinPath(sharedDir, 'constants.rs')

        await writeFile(constantsFile, 'pub const LOCAL_CONST: &str = "local";')
        await mkdir(sharedDir)
        await writeFile(sharedConstantsFile, 'pub const SHARED_CONST: &str = "shared";')
        await writeFile(
          mainFile,
          `
          #[path = "./constants.rs"]
          mod constants;

          #[path = "./shared/constants.rs"]
          mod shared_constants;

          #[path = "./non_existent.rs"]
          mod missing;

          fn main() {
              println!("{}", constants::LOCAL_CONST);
          }
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(constantsFile)
        expect(imports).toContain(sharedConstantsFile)
        expect(imports).not.toContain(joinPath(tmpDir, 'non_existent.rs'))
      })
    })

    test('handles nested module paths', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const srcDir = joinPath(tmpDir, 'src')
        const mainFile = joinPath(srcDir, 'main.rs')
        const libFile = joinPath(srcDir, 'lib.rs')
        const moduleFile = joinPath(srcDir, 'my_module.rs')

        await mkdir(srcDir)
        await writeFile(libFile, 'pub mod my_module;')
        await writeFile(moduleFile, 'pub fn my_function() {}')
        await writeFile(
          mainFile,
          `
          mod lib;

          fn main() {
              lib::my_module::my_function();
          }
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(libFile)
      })
    })

    test('handles various path formats in #[path] attribute', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.rs')
        const nestedDir = joinPath(tmpDir, 'nested', 'deep')
        const targetFile = joinPath(nestedDir, 'target.rs')

        await mkdir(nestedDir)
        await writeFile(targetFile, 'pub const VALUE: i32 = 42;')
        await writeFile(
          mainFile,
          `
          #[path = "./nested/deep/target.rs"]
          mod target;

          #[path="./nested/deep/target.rs"]
          mod target2;

          #[path = "./nested/deep/target.rs"  ]
          mod target3;
        `,
        )

        const imports = extractImportPaths(mainFile)
        expect(imports).toContain(targetFile)
        // Should not have duplicates
        expect(imports.filter((path) => path === targetFile)).toHaveLength(1)
      })
    })
  })

  describe('Mixed language projects', () => {
    test('handles files with unrecognized extensions', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        const mainFile = joinPath(tmpDir, 'main.unknown')
        await writeFile(mainFile, 'import something from "./other"')

        const imports = extractImportPaths(mainFile)
        expect(imports).toHaveLength(0)
      })
    })
  })
})

describe('extractImportPathsRecursively', () => {
  test('recursively extracts imports from multiple levels', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const mainFile = joinPath(tmpDir, 'main.js')
      const utilsFile = joinPath(tmpDir, 'utils.js')
      const helpersFile = joinPath(tmpDir, 'helpers.js')
      const constantsFile = joinPath(tmpDir, 'constants.js')

      // main imports utils
      // utils imports helpers
      // helpers imports constants
      await writeFile(constantsFile, 'export const API_URL = "https://api.example.com"')
      await writeFile(
        helpersFile,
        `
        import { API_URL } from './constants.js'
        export const fetchData = () => fetch(API_URL)
      `,
      )
      await writeFile(
        utilsFile,
        `
        import { fetchData } from './helpers.js'
        export const getData = async () => await fetchData()
      `,
      )
      await writeFile(
        mainFile,
        `
        import { getData } from './utils.js'
        getData()
      `,
      )

      const imports = extractImportPathsRecursively(mainFile)
      expect(imports).toContain(utilsFile)
      expect(imports).toContain(helpersFile)
      expect(imports).toContain(constantsFile)
      expect(imports).toHaveLength(3)
    })
  })

  test('handles circular dependencies', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const fileA = joinPath(tmpDir, 'a.js')
      const fileB = joinPath(tmpDir, 'b.js')
      const fileC = joinPath(tmpDir, 'c.js')

      // Create circular dependency: A -> B -> C -> A
      await writeFile(
        fileA,
        `
        import { b } from './b.js'
        export const a = 'a'
      `,
      )
      await writeFile(
        fileB,
        `
        import { c } from './c.js'
        export const b = 'b'
      `,
      )
      await writeFile(
        fileC,
        `
        import { a } from './a.js'
        export const c = 'c'
      `,
      )

      const imports = extractImportPathsRecursively(fileA)
      expect(imports).toContain(fileB)
      expect(imports).toContain(fileC)
      // A is imported by C
      expect(imports).toContain(fileA)
      expect(imports).toHaveLength(3)
    })
  })

  test('works with TypeScript and mixed imports', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const mainFile = joinPath(tmpDir, 'main.ts')
      const componentFile = joinPath(tmpDir, 'component.tsx')
      const utilsFile = joinPath(tmpDir, 'utils.ts')
      const configFile = joinPath(tmpDir, 'config.js')

      await writeFile(configFile, 'export const config = { port: 3000 }')
      await writeFile(
        utilsFile,
        `
        const { config } = require('./config.js')
        export const getPort = () => config.port
      `,
      )
      await writeFile(
        componentFile,
        `
        import { getPort } from './utils'
        export const Component = () => <div>Port: {getPort()}</div>
      `,
      )
      await writeFile(
        mainFile,
        `
        import { Component } from './component'
        console.log(Component)
      `,
      )

      const imports = extractImportPathsRecursively(mainFile)
      expect(imports).toContain(componentFile)
      expect(imports).toContain(utilsFile)
      expect(imports).toContain(configFile)
      expect(imports).toHaveLength(3)
    })
  })

  test('handles non-existent imports gracefully', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const mainFile = joinPath(tmpDir, 'main.js')
      const existingFile = joinPath(tmpDir, 'existing.js')

      await writeFile(existingFile, 'export const exists = true')
      await writeFile(
        mainFile,
        `
        import { exists } from './existing.js'
        import { missing } from './missing.js'
      `,
      )

      const imports = extractImportPathsRecursively(mainFile)
      expect(imports).toContain(existingFile)
      expect(imports).not.toContain(joinPath(tmpDir, 'missing.js'))
      expect(imports).toHaveLength(1)
    })
  })

  test('works with Rust modules recursively', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const mainFile = joinPath(tmpDir, 'main.rs')
      const libFile = joinPath(tmpDir, 'lib.rs')
      const utilsFile = joinPath(tmpDir, 'utils.rs')
      const helpersFile = joinPath(tmpDir, 'helpers.rs')

      await writeFile(helpersFile, 'pub fn help() {}')
      await writeFile(
        utilsFile,
        `
        mod helpers;
        pub fn util() { helpers::help(); }
      `,
      )
      await writeFile(
        libFile,
        `
        mod utils;
        pub fn lib_func() { utils::util(); }
      `,
      )
      await writeFile(
        mainFile,
        `
        mod lib;
        fn main() { lib::lib_func(); }
      `,
      )

      const imports = extractImportPathsRecursively(mainFile)
      expect(imports).toContain(libFile)
      expect(imports).toContain(utilsFile)
      expect(imports).toContain(helpersFile)
      expect(imports).toHaveLength(3)
    })
  })

  test('handles deeply nested imports', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const files: string[] = []
      const depth = 10

      // Create a chain of imports
      const writePromises: Promise<void>[] = []
      for (let i = 0; i < depth; i++) {
        const fileName = `file${i}.js`
        const filePath = joinPath(tmpDir, fileName)
        files.push(filePath)

        if (i === depth - 1) {
          writePromises.push(writeFile(filePath, `export const value = ${i}`))
        } else {
          writePromises.push(
            writeFile(
              filePath,
              `
            import { value } from './file${i + 1}.js'
            export const value${i} = value + ${i}
          `,
            ),
          )
        }
      }
      await Promise.all(writePromises)

      const imports = extractImportPathsRecursively(files[0]!)
      // Should find all files except the first one (which is the starting point)
      expect(imports).toHaveLength(depth - 1)
      for (let i = 1; i < depth; i++) {
        expect(imports).toContain(files[i])
      }
    })
  })

  test('handles imports from index files in directories', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const mainFile = joinPath(tmpDir, 'main.js')
      const componentsDir = joinPath(tmpDir, 'components')
      const componentsIndex = joinPath(componentsDir, 'index.js')
      const buttonFile = joinPath(componentsDir, 'Button.js')
      const inputFile = joinPath(componentsDir, 'Input.js')

      await mkdir(componentsDir)
      await writeFile(buttonFile, 'export const Button = () => {}')
      await writeFile(inputFile, 'export const Input = () => {}')
      await writeFile(
        componentsIndex,
        `
        export { Button } from './Button.js'
        export { Input } from './Input.js'
      `,
      )
      await writeFile(
        mainFile,
        `
        import { Button, Input } from './components'
      `,
      )

      const imports = extractImportPathsRecursively(mainFile)

      // When importing from './components', the resolveJSImport function returns the directory path
      // The recursive function doesn't currently handle following imports from directories
      // This is a known limitation of the current implementation
      expect(imports).toContain(componentsDir)
      expect(imports).toHaveLength(1)
    })
  })

  test('deduplicates imports when multiple files import the same module', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const mainFile = joinPath(tmpDir, 'main.js')
      const moduleA = joinPath(tmpDir, 'moduleA.js')
      const moduleB = joinPath(tmpDir, 'moduleB.js')
      const sharedModule = joinPath(tmpDir, 'shared.js')

      await writeFile(sharedModule, 'export const shared = "shared value"')
      await writeFile(
        moduleA,
        `
        import { shared } from './shared.js'
        export const a = shared + " from A"
      `,
      )
      await writeFile(
        moduleB,
        `
        import { shared } from './shared.js'
        export const b = shared + " from B"
      `,
      )
      await writeFile(
        mainFile,
        `
        import { a } from './moduleA.js'
        import { b } from './moduleB.js'
        import { shared } from './shared.js'
      `,
      )

      const imports = extractImportPathsRecursively(mainFile)
      expect(imports).toContain(moduleA)
      expect(imports).toContain(moduleB)
      expect(imports).toContain(sharedModule)
      expect(imports).toHaveLength(3)
      // Ensure sharedModule appears only once despite being imported by multiple files
      expect(imports.filter((imp) => imp === sharedModule)).toHaveLength(1)
    })
  })
})
