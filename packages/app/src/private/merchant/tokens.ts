export function getAdminToken(): string {
  return process.env.SHOPIFY_ADMIN_TOKEN as string
}
