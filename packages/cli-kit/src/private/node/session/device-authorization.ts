export interface DeviceAuthorizationResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  verificationUriComplete?: string
  interval?: number
}

// export async function pollForDeviceAuthorization(code: string, interval = 5): Promise<IdentityToken> {}
