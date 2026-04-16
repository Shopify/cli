export const autoUpgradeStatus = {
  on: 'Auto-upgrade on. Shopify CLI will update automatically after each command.',
  off: "Auto-upgrade off. You'll need to run `shopify upgrade` to update manually.",
  notConfigured: 'Auto-upgrade not configured. Run `shopify config autoupgrade on` to enable it.',
} as const
