/**
 * Authentication and Session Constants
 * Configured for 3-month (90 days) Remember Me persistence.
 */

// 3 months (90 days) in seconds: 90 days * 24 hours * 60 minutes * 60 seconds
export const REMEMBER_ME_MAX_AGE = 90 * 24 * 60 * 60 // 7,776,000 seconds

export const REMEMBER_ME_COOKIE_NAME = 'pir_remember_me'

export const DEFAULT_COOKIE_OPTIONS = {
  maxAge: REMEMBER_ME_MAX_AGE,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}
