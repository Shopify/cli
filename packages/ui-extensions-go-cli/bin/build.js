#!/usr/bin/env node

import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const execa = require('execa')

const arch = "xxx"
const os = "windows" // GOOS
const executableName = (os === "windows") ? "shopify-extensions.exe" : "shopify-extensions"
const canonicalName = (os === "windows") ? `shopify-extensions-${os}-${arch}.exe` :  `shopify-extensions-${os}-${arch}`


// build: go build -o ${executable}
// build-debug: go build -gcflags=all="-N -l" -o ${executable}
