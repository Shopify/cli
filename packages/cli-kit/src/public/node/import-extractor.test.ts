import {inTemporaryDirectory, mkdir, writeFile} from './fs.js'
import {joinPath} from './path.js'
import {extractImportPaths} from './import-extractor.js'
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

        await mkdir(nestedDir, {recursive: true})
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
