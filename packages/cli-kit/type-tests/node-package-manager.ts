// Compile against the published declarations after building cli-kit, with exactOptionalPropertyTypes enabled.
import {checkForNewVersion} from '../dist/public/node/node-package-manager.js'

// eslint-disable-next-line no-void
void checkForNewVersion('@shopify/cli', '5.0.0', {cacheExpiryInHours: undefined})
