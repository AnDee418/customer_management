/**
 * OAuth2 Client Credentials Configuration
 *
 * Manages OAuth2 client registrations for machine-to-machine (M2M) authentication.
 * Each client represents an external microservice that needs to access this system's APIs.
 */

export interface OAuth2Client {
  clientId: string
  clientSecret: string
  scopes: string[]
  description?: string
  ipAllowlist?: string[] // Optional IP restrictions
}

/**
 * OAuth2 Client Registry
 *
 * In production, these should be stored in a secure database or secret manager.
 * For now, we use environment variables for simplicity.
 *
 * Environment variable format:
 * OAUTH2_CLIENTS={"client_id_1":{"secret":"xxx","scopes":["customers:read"]},"client_id_2":{...}}
 */
export function getOAuth2Clients(): Record<string, OAuth2Client> {
  // Try to load from environment variable
  const clientsEnv = process.env.OAUTH2_CLIENTS

  if (clientsEnv) {
    try {
      const parsed = JSON.parse(clientsEnv)
      return parsed
    } catch (err) {
      console.error('Failed to parse OAUTH2_CLIENTS environment variable:', err)
    }
  }

  // Fallback to individual environment variables
  const clients: Record<string, OAuth2Client> = {}

  // Order Service Client
  if (process.env.ORDER_SERVICE_CLIENT_ID && process.env.ORDER_SERVICE_CLIENT_SECRET) {
    clients[process.env.ORDER_SERVICE_CLIENT_ID] = {
      clientId: process.env.ORDER_SERVICE_CLIENT_ID,
      clientSecret: process.env.ORDER_SERVICE_CLIENT_SECRET,
      scopes: ['customers:read', 'customers:write'],
      description: 'Order Management Service'
    }
  }

  // Measurement Service Client
  if (process.env.MEASUREMENT_SERVICE_CLIENT_ID && process.env.MEASUREMENT_SERVICE_CLIENT_SECRET) {
    clients[process.env.MEASUREMENT_SERVICE_CLIENT_ID] = {
      clientId: process.env.MEASUREMENT_SERVICE_CLIENT_ID,
      clientSecret: process.env.MEASUREMENT_SERVICE_CLIENT_SECRET,
      scopes: ['customers:read'],
      description: 'Measurement Management Service'
    }
  }

  return clients
}

/**
 * Get OAuth2 client by client ID
 */
export function getOAuth2Client(clientId: string): OAuth2Client | null {
  const clients = getOAuth2Clients()
  return clients[clientId] || null
}

/**
 * Validate client credentials
 */
export function validateClientCredentials(
  clientId: string,
  clientSecret: string
): OAuth2Client | null {
  const client = getOAuth2Client(clientId)

  if (!client) {
    return null
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(client.clientSecret, clientSecret)) {
    return null
  }

  return client
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Validate requested scopes against client's allowed scopes
 */
export function validateScopes(
  client: OAuth2Client,
  requestedScopes: string[]
): string[] {
  return requestedScopes.filter(scope => client.scopes.includes(scope))
}

/**
 * Check if client has required scope
 */
export function hasScope(tokenScopes: string[], requiredScope: string): boolean {
  return tokenScopes.includes(requiredScope)
}
