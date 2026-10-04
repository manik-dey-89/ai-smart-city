import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import {
  FiUser, FiMail, FiLock, FiEye, FiEyeOff,
  FiAlertCircle, FiArrowLeft, FiLoader, FiShield,
} from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'
import { useGoogleAuth } from '../hooks/useGoogleAuth'

export default function Register() {
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') || 'citizen'

  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '', fullName: '',
  })
  const [showPassword,        setShowPassword]        = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error,  setError]  = useState('')
  const navigate = useNavigate()
  const { register, loading } = useAuth()

  const {
    isConfigured: googleConfigured,
    googleLoading,
    googleError,
    handleGoogleSuccess,
    handleGoogleError,
    clearGoogleError,
  } = useGoogleAuth()

  // ── Password strength indicators ──────────────────────────────────────────
  const pwd = formData.password
  const strength = {
    length:    pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    digit:     /\d/.test(pwd),
    special:   /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
  }
  const strengthScore = Object.values(strength).filter(Boolean).length
  const strengthLabel = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore]
  const strengthColor = ['', 'bg-red-500', 'bg-red-400', 'bg-yellow-400', 'bg-cyan-400', 'bg-green-400'][strengthScore]

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    try {
      await register(formData.username, formData.email, formData.password, formData.fullName, role)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  // Role display name
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')

  // Shared input class
  const inputCls = `w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4
    text-white placeholder-gray-500 text-sm focus:outline-none
    focus:border-cyan-500/60 transition-all`

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#060e1a] via-[#0d1b2a] to-[#060e1a]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: 'rgba(8,16,32,0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          {/* Back */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <FiArrowLeft size={14} /> Back to role selection
          </button>

          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FiUser size={26} className="text-cyan-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              {roleLabel} <span className="text-cyan-400">Registration</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">Create your SmartCity account</p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-5 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
              >
                <FiAlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
                <button type="button" onClick={() => setError('')} className="shrink-0 hover:text-red-300">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Google sign-up section ── */}
          <div className="mb-6 space-y-3">
            <p className="text-xs text-gray-500 text-center uppercase tracking-wider">Quick sign-up</p>

            {/* Google error */}
            <AnimatePresence>
              {googleError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs"
                >
                  <FiAlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span className="flex-1">{googleError}</span>
                  <button type="button" onClick={clearGoogleError} className="shrink-0 hover:text-red-300">✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            {googleLoading && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400">
                <FiLoader size={15} className="animate-spin text-cyan-400" />
                Creating your account with Google…
              </div>
            )}

            {!googleLoading && googleConfigured && (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_black"
                  shape="rectangular"
                  size="large"
                  width="368"
                  text="signup_with"
                  logo_alignment="left"
                />
              </div>
            )}

            {!googleLoading && !googleConfigured && (
              <div className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-500 text-xs font-medium py-3 rounded-xl cursor-not-allowed select-none">
                <svg viewBox="0 0 24 24" className="w-4 h-4 opacity-40" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google sign-up not configured
              </div>
            )}

            {/* Google note — only for non-citizen roles */}
            {role !== 'citizen' && (
              <p className="text-xs text-amber-400/70 text-center">
                Google sign-up creates a citizen account. For other roles, use the form below.
              </p>
            )}
          </div>

          {/* OR divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500">OR register with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ── Registration form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text" value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className={inputCls} placeholder="Enter your full name" required
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Username</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text" value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className={inputCls} placeholder="Choose a username" required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="email" value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={inputCls} placeholder="Enter your email" required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className={`${inputCls} pr-11`}
                  placeholder="Create a password" required
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {formData.password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                          i <= strengthScore ? strengthColor : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {Object.entries(strength)
                        .filter(([, ok]) => !ok)
                        .map(([k]) => ({
                          length: '8+ chars', uppercase: 'uppercase',
                          lowercase: 'lowercase', digit: 'number', special: 'symbol',
                        }[k as keyof typeof strength]))
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(', ')}
                      {Object.values(strength).every(Boolean) ? '✓ All requirements met' : ' required'}
                    </p>
                    <span className={`text-xs font-semibold ${
                      strengthScore >= 5 ? 'text-green-400' :
                      strengthScore >= 4 ? 'text-cyan-400'  :
                      strengthScore >= 3 ? 'text-yellow-400': 'text-red-400'
                    }`}>{strengthLabel}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Confirm Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`${inputCls} pr-11 ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? 'border-red-500/50' : ''
                  }`}
                  placeholder="Confirm your password" required
                />
                <button
                  type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400
                disabled:bg-cyan-500/40 disabled:cursor-not-allowed
                text-black font-bold py-3 rounded-xl text-sm transition-all mt-1"
            >
              {loading
                ? <><FiLoader size={14} className="animate-spin" /> Creating account…</>
                : 'Create Account'
              }
            </button>

            {/* Security note */}
            <div className="flex items-center gap-2 text-xs text-gray-600 justify-center pt-1">
              <FiShield size={12} />
              Your data is encrypted and secure
            </div>

            {/* Sign in link */}
            <p className="text-center text-sm text-gray-400">
              Already have an account?{' '}
              <Link to={`/login?role=${role}`} className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
