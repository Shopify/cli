import {performance} from 'perf_hooks';
import {enableCompileCache} from 'node:module';
enableCompileCache();

const s = performance.now();
const {default: runCLI} = await import('./dist/bootstrap.js');
console.error('import bootstrap:', (performance.now() - s).toFixed(0) + 'ms');
// bootstrap already set up everything, just need to not run CLI
// Actually this triggers runShopifyCLI... Let me try differently.
