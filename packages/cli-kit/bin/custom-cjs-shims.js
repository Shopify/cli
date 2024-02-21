import { createRequire } from 'node:module';
import path, { join } from 'node:path';
import url from 'node:url';

globalThis.require = createRequire(import.meta.url);
globalThis.__filename = url.fileURLToPath(import.meta.url);
globalThis.__dirname = join(path.dirname(__filename), 'cli-kit');
