/**
 * User Context Utilities
 *
 * Handles user context propagation from external microservices.
 * Maps external user IDs to internal user IDs and manages user provisioning.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export interface UserContext {
  /** External user ID from the originating microservice */
  externalUserId: string
  /** Internal user ID (mapped from external ID) */
  internalUserId?: string
  /** User email */
  email: string
  /** User role */
  role: 'admin' | 'manager' | 'user' | 'viewer' | 'agency'
  /** Display name (optional) */
  displayName?: string
  /** Team/location ID (optional) */
  teamId?: string
}

export interface ParsedUserContext {
  success: boolean
  userContext?: UserContext
  error?: string
}

/**
 * Parse and validate X-User-Context header
 */
export function parseUserContextHeader(request: NextRequest): ParsedUserContext {
  const userContextHeader = request.headers.get('x-user-context')

  if (!userContextHeader) {
    return {
      success: false,
      error: 'Missing X-User-Context header'
    }
  }

  try {
    const parsed = JSON.parse(userContextHeader)

    // Validate required fields
    if (!parsed.user_id || !parsed.email) {
      return {
        success: false,
        error: 'Invalid user context: missing required fields (user_id, email)'
      }
    }

    // Normalize role
    const role = parsed.role || 'user'
    if (!['admin', 'manager', 'user', 'viewer', 'agency'].includes(role)) {
      return {
        success: false,
        error: `Invalid role: ${role}`
      }
    }

    const userContext: UserContext = {
      externalUserId: parsed.user_id,
      email: parsed.email,
      role,
      displayName: parsed.display_name || parsed.email.split('@')[0],
      teamId: parsed.team_id
    }

    return {
      success: true,
      userContext
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse X-User-Context header'
    }
  }
}

/**
 * Map external user ID to internal user ID
 *
 * This function looks up the internal user ID based on the external user ID.
 * If the user doesn't exist, it optionally creates a new profile.
 *
 * @param userContext - User context from external system
 * @param autoProvision - If true, automatically create new user profiles
 * @returns Updated user context with internal user ID
 */
export async function mapExternalUserToInternal(
  userContext: UserContext,
  autoProvision: boolean = true
): Promise<UserContext> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // 1. Try to find existing user by external_user_id
  const { data: existingProfile, error: lookupError } = await supabase
    .from('profiles')
    .select('id, role, team_id')
    .eq('external_user_id', userContext.externalUserId)
    .maybeSingle()

  if (lookupError) {
    console.error('Failed to lookup user by external_user_id:', lookupError)
    throw new Error('User lookup failed')
  }

  if (existingProfile) {
    // User exists, use internal ID and role from database
    return {
      ...userContext,
      internalUserId: existingProfile.id,
      role: existingProfile.role,
      teamId: existingProfile.team_id || userContext.teamId
    }
  }

  // 2. User doesn't exist
  if (!autoProvision) {
    throw new Error(`User not found: ${userContext.externalUserId}`)
  }

  // 3. Auto-provision new user
  console.info('Auto-provisioning new user from external system:', {
    external_user_id: userContext.externalUserId,
    email: userContext.email,
    role: userContext.role
  })

  // Create a temporary auth user (optional, for linking with Supabase Auth)
  // In this case, we'll create a profile directly without auth user

  const { data: newProfile, error: createError } = await supabase
    .from('profiles')
    .insert({
      external_user_id: userContext.externalUserId,
      email: userContext.email,
      display_name: userContext.displayName || userContext.email.split('@')[0],
      role: userContext.role,
      team_id: userContext.teamId || null
    })
    .select('id, role, team_id')
    .single()

  if (createError || !newProfile) {
    console.error('Failed to create new user profile:', createError)
    throw new Error('User provisioning failed')
  }

  console.info('User provisioned successfully:', {
    internal_user_id: newProfile.id,
    external_user_id: userContext.externalUserId
  })

  return {
    ...userContext,
    internalUserId: newProfile.id,
    role: newProfile.role,
    teamId: newProfile.team_id || userContext.teamId
  }
}

/**
 * Get user context from request with automatic user mapping
 *
 * This is the main function to use in M2M API endpoints.
 * It extracts user context from the request and maps external user ID to internal ID.
 *
 * @param request - Next.js request object
 * @param autoProvision - If true, automatically create new user profiles
 * @returns Mapped user context or null if not provided
 */
export async function getUserContextFromRequest(
  request: NextRequest,
  autoProvision: boolean = true
): Promise<UserContext | null> {
  const parsed = parseUserContextHeader(request)

  if (!parsed.success || !parsed.userContext) {
    // User context is optional for some M2M operations
    return null
  }

  try {
    const mappedContext = await mapExternalUserToInternal(
      parsed.userContext,
      autoProvision
    )

    return mappedContext
  } catch (error) {
    console.error('Failed to map external user to internal:', error)
    return null
  }
}

/**
 * Apply RLS-equivalent filtering based on user context
 *
 * This function adds WHERE clauses to Supabase queries to enforce
 * row-level security based on user role and ownership.
 *
 * @param query - Supabase query builder
 * @param userContext - User context (null = no filtering)
 * @param ownerColumn - Column name for owner_user_id (default: 'owner_user_id')
 * @returns Modified query with RLS filtering
 */
export function applyRLSFilter<T>(
  query: any,
  userContext: UserContext | null,
  ownerColumn: string = 'owner_user_id'
): any {
  if (!userContext || !userContext.internalUserId) {
    // No user context = no filtering (full access via service role)
    return query
  }

  // Admin and manager have full access
  if (userContext.role === 'admin' || userContext.role === 'manager') {
    return query
  }

  // Regular users can only see their own data
  return query.eq(ownerColumn, userContext.internalUserId)
}
