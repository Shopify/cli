import {realpath} from 'fs/promises'
import {tmpdir} from 'os'

// Captured at module load time, before test mocks can interfere.
// Async realpath resolves symlinks (e.g. /var -> /private/var on macOS)
// and 8.3 short names on Windows (e.g. RUNNER~1 -> runneradmin),
// matching tempy's temp-dir behavior.
export const systemTempDir = await realpath(tmpdir())
