import * as styles from './GraphiQL.module.scss'
import React, {useState, useMemo} from 'react'
import {Text} from '@shopify/polaris'
import type {GraphiQLConfig} from '@/types/config.ts'
import {useServerStatus} from '@/hooks/index.ts'
import {StatusBadge} from '@/components/StatusBadge/index.ts'
import {ErrorBanner} from '@/components/ErrorBanner/index.ts'
import {LinkPills} from '@/components/LinkPills/index.ts'
import {ApiVersionSelector} from '@/components/ApiVersionSelector/index.ts'
import {GraphiQLEditor} from '@/components/GraphiQLEditor/index.ts'
import {validateConfig} from '@/utils/configValidation.ts'

// Helper to get config from window or fallback to env/defaults
// Security: Validates window.__GRAPHIQL_CONFIG__ to prevent XSS attacks
function getConfig(): GraphiQLConfig {
  // Fallback config for development
  const fallbackConfig: GraphiQLConfig = {
    baseUrl: import.meta.env.VITE_GRAPHIQL_BASE_URL ?? 'http://localhost:3457',
    apiVersion: '2024-10',
    apiVersions: ['2024-01', '2024-04', '2024-07', '2024-10', 'unstable'],
    appName: 'Development App',
    appUrl: 'http://localhost:3000',
    storeFqdn: 'test-store.myshopify.com',
  }

  if (typeof window !== 'undefined' && window.__GRAPHIQL_CONFIG__) {
    // SECURITY: Validate and sanitize config before use
    return validateConfig(window.__GRAPHIQL_CONFIG__, fallbackConfig)
  }

  return fallbackConfig
}

export function GraphiQLSection() {
  const config = useMemo(() => getConfig(), [])
  const [selectedVersion, setSelectedVersion] = useState(config.apiVersion)

  const status = useServerStatus({baseUrl: config.baseUrl})

  const handleVersionChange = (version: string) => {
    setSelectedVersion(version)
    // GraphiQL component (Track 6) will use this version in fetcher URL
  }

  return (
    <div className={styles.Container}>
      {/* Error banner - shown when server disconnects */}
      {!status.serverIsLive && (
        <div className={styles.ErrorBanner}>
          <ErrorBanner isVisible={!status.serverIsLive} />
        </div>
      )}

      <div className={styles.Header}>
        <div className={styles.LeftSection}>
          <div className={styles.StatusSection}>
            <StatusBadge status={status} />
          </div>

          <div className={styles.ControlsSection}>
            <label htmlFor="api-version-select" style={{marginRight: '8px'}}>
              API version:
            </label>
            <div style={{minWidth: '150px'}}>
              <ApiVersionSelector versions={config.apiVersions} value={selectedVersion} onChange={handleVersionChange} />
            </div>
          </div>

          <div className={styles.LinksSection}>
            <LinkPills status={status} />
          </div>
        </div>

        <div className={styles.RightSection}>
          <div className={styles.ScopesNote}>
            <Text as="span" tone="subdued">
              GraphiQL runs on the same access scopes you've defined in the TOML file for your app.
            </Text>
          </div>
        </div>
      </div>

      <div className={styles.GraphiQLContainer}>
        <GraphiQLEditor config={config} apiVersion={selectedVersion} />
      </div>
    </div>
  )
}
