import {writeFileSync} from 'fs';
import {join, relative} from 'path';

import type {Plugin} from 'vite';

const cwd = (...paths: string[]) => join(process.cwd(), ...paths);

export interface CreateEntryFilesOptions {
  files: {[key: string]: string};
}

export function createEntryFiles(options: CreateEntryFilesOptions): Plugin {
  return {
    name: 'Create Entry Files',
    enforce: 'post',
    configResolved(config) {
      if (!config.build.lib) {
        return;
      }

      const {formats = []} = config.build.lib ?? {};
      Object.entries(options.files).forEach(([key, path]) => {
        writeFileSync(
          cwd(`${key}.d.ts`),
          `export * from './${relative(
            cwd(),
            path.endsWith('/index') ? path.replace('/index', '') : path,
          )}';\n`,
        );
        formats.forEach((format) => {
          if (format === 'cjs') {
            writeFileSync(
              cwd(`${key}.js`),
              `module.exports = require('./${relative(cwd(), path)}.cjs');\n`,
            );
          }
          if (format === 'es') {
            writeFileSync(cwd(`${key}.mjs`), `export * from './${relative(cwd(), path)}.es.js';\n`);
          }
        });
      });
    },
  };
}
