/**
 * useGoogleAuth
 * -------------
 * Shared hook that handles the full Google sign-in / sign-up flow:
 *   1. Google pops up and returns a credential (ID token)
 *   2. We POST it to POST /api/auth/google
 *   3. Backend verifies it and returns { access_token, refresh_token }
 *   4. We fetch /api/auth/me and hydrate AuthContext exactly like normal login
 *
 * States exposed:
 *   googleLoading  – true while the backend call is in flight
 *   googleError    – human-readable error string, empty when ok
 *   handleGoogleSuccess(credentialResponse) – call from GoogleLogin.onSuccess
 *   handleGoogleError()                     – call from GoogleLogin.onError
 *
 * Behaviour when VITE_GOOGLE_CLIENT_ID is not set:
 *   isConfigured = false → UI can show a "not configured" message instead
 *   of the live button.
 */
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CredentialResponse } from '@react-oauth/google'

// We import useAuth to keep the hook consistent, but don't call it directly —
// after Google sign-in succeeds we write to localStorage and do a full navigation
// so AuthContext re-hydrates from storage on the next render.
import { useAuth } from '../contexts/AuthContext'

const API_BASE = '/api'

export function useGoogleAuth() {
  useAuth() // ensure hook is called inside AuthProvider tree; result unused here
  const navigate = useNavigate()

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError,   setGoogleError]   = useState('')

  // Whether the Google Client ID has been configured in the environment
  const isConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

  /**
   * Called by GoogleLogin's onSuccess callback.
   * credentialResponse.credential is the ID token string from Google.
   */
  const handleGoogleSuccess = useCallback(async (credentialResponse: CredentialResponse) => {
    const credential = credentialResponse.credential
    if (!credential) {
      setGoogleError('Google did not return a credential. Please try again.')
      return
    }

    setGoogleLoading(true)
    setGoogleError('')

    try {
      // ── 1. Send ID token to backend ──────────────────────────────────────
      const tokenRes = await fetch(`${API_BASE}/auth/google`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ credential }),
      })

      if (!tokenRes.ok) {
        let detail = 'Google sign-in failed. Please try again.'
        try {
          const json = await tokenRes.json()
          detail = json.detail || detail
        } catch { /* ignore */ }

        // Friendly message for the "not configured" case
        if (tokenRes.status === 501) {
          detail = 'Google sign-in is not configured on this server. Please use username & password.'
        }
        setGoogleError(detail)
        return
      }

      const tokenData: { access_token: string; refresh_token: string } = await tokenRes.json()

      // ── 2. Fetch the user profile ─────────────────────────────────────────
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })

      if (!meRes.ok) {
        setGoogleError('Signed in but could not load your profile. Please refresh.')
        return
      }

      const user = await meRes.json()

      // ── 3. Hydrate AuthContext + localStorage ─────────────────────────────
      localStorage.setItem('access_token',  tokenData.access_token)
      localStorage.setItem('refresh_token', tokenData.refresh_token)
      localStorage.setItem('user',          JSON.stringify(user))

      // Force AuthContext to re-read from localStorage by reloading the page.
      // This is the same approach used by the normal login flow's window.location.reload()
      // in Profile.tsx, and avoids the need to expose a setAuthState setter.
      window.location.href = '/dashboard'

    } catch (err) {
      const msg = err instanceof TypeError && err.message.includes('fetch')
        ? 'Network error — could not reach the server.'
        : 'Google sign-in failed. Please try again.'
      setGoogleError(msg)
    } finally {
      setGoogleLoading(false)
    }
  }, [navigate])

  const handleGoogleError = useCallback(() => {
    setGoogleError('Google sign-in was cancelled or failed. Please try again.')
  }, [])

  const clearGoogleError = useCallback(() => setGoogleError(''), [])

  return {
    isConfigured,
    googleLoading,
    googleError,
    handleGoogleSuccess,
    handleGoogleError,
    clearGoogleError,
  }
}
