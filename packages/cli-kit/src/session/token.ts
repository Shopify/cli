/**
 * It represents a temporary token that can be
 * used to send authenticated HTTP requests.
 */
class Token {
  /**
   * A fully-qualified domain name of the service
   * this token is for.
   */
  fqdn: string

  /**
   * Access token
   */
  accessToken: string

  /**
   * Token to refresh the access token if it has expired.
   */
  refreshToken?: string

  /**
   * The expiration date of the session
   */
  expiresAt: Date

  /**
   * The list of scopes the token has access to.
   */
  scopes: string[]

  constructor(options: {fqdn: string; accessToken: string; refreshToken?: string; expiresAt: Date; scopes: string[]}) {
    this.fqdn = options.fqdn
    this.accessToken = options.accessToken
    this.refreshToken = options.refreshToken
    this.expiresAt = options.expiresAt
    this.scopes = options.scopes
  }

  /**
   * Returns true if the session is expired.
   * @returns {boolean} True if the session is expired.
   */
  get isExpired(): boolean {
    return new Date() > this.expiresAt
  }
}

export default Token
