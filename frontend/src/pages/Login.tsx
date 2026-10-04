import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import {
  FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle, FiArrowLeft,
  FiShield, FiBarChart2, FiSliders, FiBell, FiUsers,
  FiMapPin, FiTruck, FiActivity,
  FiPhone, FiVolume2, FiLoader,
} from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'
import { useGoogleAuth } from '../hooks/useGoogleAuth'

/* ─── Per-role configuration ─────────────────────────────────── */
interface RoleFeature {
  icon: React.ReactNode
  title: string
  desc: string
}

interface RoleConfig {
  bg: string                // background image path
  accent: string            // Tailwind text colour class  (e.g. "text-blue-400")
  accentHex: string         // raw hex for inline styles / gradients
  accentBtnFrom: string     // gradient-from class
  accentBtnTo: string       // gradient-to class
  badgeBg: string           // icon-badge background
  logoIcon: React.ReactNode
  logoSubtitle: string
  welcomeTag: string        // small green/colour label above headline
  headline: string          // large left-side headline  (supports \n)
  headlineAccent: string    // the word coloured in accent
  subText: string
  features: RoleFeature[]
  quote?: string
  quoteSource?: string
  hotline?: { label: string; number: string; note: string }
  footerText: string
  roleName: string          // display name in login card title
}

const roleConfigs: Record<string, RoleConfig> = {
  /* ── ADMIN ─────────────────────────────────────────────────── */
  admin: {
    bg: '/backgrounds/admin_background.png',
    accent: 'text-blue-400',
    accentHex: '#60a5fa',
    accentBtnFrom: 'from-blue-600',
    accentBtnTo: 'to-blue-500',
    badgeBg: 'bg-blue-500/20',
    logoIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    logoSubtitle: 'Admin Dashboard',
    welcomeTag: 'Welcome Back, Administrator!',
    headline: 'Command. Monitor.\nOptimize.',
    headlineAccent: 'Everything in Control.',
    subText: 'Access real-time data, manage users, monitor systems and take smart actions to build a better tomorrow.',
    features: [
      { icon: <FiUsers size={16} />, title: 'User Management', desc: 'Manage users, roles and permissions with ease' },
      { icon: <FiShield size={16} />, title: 'System Security', desc: 'Monitor security logs, threats and system activities' },
      { icon: <FiBarChart2 size={16} />, title: 'Analytics & Reports', desc: 'Get real-time analytics and download detailed reports' },
      { icon: <FiSliders size={16} />, title: 'System Control', desc: 'Control services, configurations and system integrations' },
      { icon: <FiBell size={16} />, title: 'Real-time Alerts', desc: 'Stay informed with instant alerts and notifications' },
    ],
    quote: 'Secure • Reliable • Powerful',
    quoteSource: 'Built for administrators, by SmartCity.',
    footerText: '© 2025 SmartCity Admin Portal. All rights reserved.',
    roleName: 'Admin',
  },

  /* ── CITIZEN ────────────────────────────────────────────────── */
  citizen: {
    bg: '/backgrounds/citizen_background.png',
    accent: 'text-cyan-400',
    accentHex: '#22d3ee',
    accentBtnFrom: 'from-cyan-500',
    accentBtnTo: 'to-green-500',
    badgeBg: 'bg-cyan-500/20',
    logoIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
      </svg>
    ),
    logoSubtitle: 'Better City, Better Life',
    welcomeTag: 'Welcome Citizen!',
    headline: 'Build a Better\nTomorrow',
    headlineAccent: 'Together',
    subText: 'Access city information, report issues, explore services and stay updated for a smarter, cleaner & safer city.',
    features: [
      { icon: <FiUsers size={16} />, title: 'Citizen Services', desc: 'Access various city services and information' },
      { icon: <FiVolume2 size={16} />, title: 'Report Issues', desc: 'Help us improve your city by reporting issues' },
      { icon: <FiBell size={16} />, title: 'Real-time Updates', desc: 'Get real-time updates and important notifications' },
      { icon: <FiBarChart2 size={16} />, title: 'City Transparency', desc: 'Open data and transparency for a better tomorrow' },
    ],
    quote: 'Your data is safe with us',
    quoteSource: 'We prioritize your privacy and data security.',
    footerText: '© 2026 SmartCity Portal. All rights reserved.',
    roleName: 'Citizen',
  },

  /* ── POLICE ─────────────────────────────────────────────────── */
  police: {
    bg: '/backgrounds/police_background.png',
    accent: 'text-blue-400',
    accentHex: '#60a5fa',
    accentBtnFrom: 'from-blue-600',
    accentBtnTo: 'to-blue-500',
    badgeBg: 'bg-blue-500/20',
    logoIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" />
      </svg>
    ),
    logoSubtitle: 'Safer City, Better Life',
    welcomeTag: '',
    headline: 'Smart Policing\nfor a',
    headlineAccent: 'Safer Tomorrow',
    subText: 'Secure login portal for police officers to manage operations, records and ensure a safer city for everyone.',
    features: [
      { icon: <FiShield size={16} />, title: 'Secure Access', desc: 'Protected & encrypted login' },
      { icon: <FiActivity size={16} />, title: 'Real-time Operations', desc: 'Stay connected, stay ahead' },
      { icon: <FiBarChart2 size={16} />, title: 'Data & Intelligence', desc: 'Smart data for smart policing' },
    ],
    quote: '"To protect and to serve"',
    quoteSource: 'with pride and integrity.',
    footerText: '© 2025 SmartCity Policing Portal. All rights reserved.',
    roleName: 'Police',
  },

  /* ── FIRE SERVICE ───────────────────────────────────────────── */
  fire_service: {
    bg: '/backgrounds/fire_service_background.png',
    accent: 'text-red-400',
    accentHex: '#f87171',
    accentBtnFrom: 'from-red-600',
    accentBtnTo: 'to-red-500',
    badgeBg: 'bg-red-500/20',
    logoIcon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2C9 7 6 9 6 13a6 6 0 0012 0c0-4-3-6-6-11zm0 16a4 4 0 01-4-4c0-2.5 1.5-4 4-7 2.5 3 4 4.5 4 7a4 4 0 01-4 4z" />
      </svg>
    ),
    logoSubtitle: 'Safer City, Better Life',
    welcomeTag: '',
    headline: 'Smart Fire Services\nfor a',
    headlineAccent: 'Safer Tomorrow',
    subText: 'Secure login portal for fire service personnel to manage operations, respond faster and protect lives & property.',
    features: [
      { icon: <FiShield size={16} />, title: 'Secure Access', desc: 'Encrypted & authorized login' },
      { icon: <FiBell size={16} />, title: 'Emergency Alerts', desc: 'Real-time fire & incident notifications' },
      { icon: <FiTruck size={16} />, title: 'Quick Response', desc: 'Dispatch & resource management' },
      { icon: <FiBarChart2 size={16} />, title: 'Data & Reports', desc: 'Analytics for better decision making' },
    ],
    quote: 'Courage to Act,\nCommitment to Protect.',
    footerText: '© 2025 SmartCity Fire Services Portal. All rights reserved.',
    roleName: 'Fire Service',
  },

  /* ── EMERGENCY ──────────────────────────────────────────────── */
  emergency: {
    bg: '/backgrounds/emergency_background.png',
    accent: 'text-red-400',
    accentHex: '#f87171',
    accentBtnFrom: 'from-red-600',
    accentBtnTo: 'to-red-500',
    badgeBg: 'bg-red-500/20',
    logoIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    logoSubtitle: 'Safer City, Better Life',
    welcomeTag: '',
    headline: 'Smart Emergency\nResponse for a',
    headlineAccent: 'Safer Tomorrow',
    subText: 'Secure login portal for emergency responders to manage incidents, alert teams and save lives.',
    features: [
      { icon: <FiShield size={16} />, title: 'Secure Access', desc: 'Encrypted & authorized login' },
      { icon: <FiBell size={16} />, title: 'Real-time Alerts', desc: 'Instant emergency notifications' },
      { icon: <FiActivity size={16} />, title: 'Rapid Response', desc: 'Quick dispatch & coordination' },
      { icon: <FiMapPin size={16} />, title: 'Live Monitoring', desc: 'Track incidents in real-time' },
    ],
    hotline: { label: 'Emergency Hotline', number: '112', note: '24/7 Available' },
    footerText: '© 2025 SmartCity Emergency Portal. All rights reserved.',
    roleName: 'Emergency',
  },

  /* ── TRAFFIC OFFICER (fallback → admin bg) ─────────────────── */
  traffic_officer: {
    bg: '/backgrounds/admin_background.png',
    accent: 'text-orange-400',
    accentHex: '#fb923c',
    accentBtnFrom: 'from-orange-600',
    accentBtnTo: 'to-orange-500',
    badgeBg: 'bg-orange-500/20',
    logoIcon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="1" y="3" width="15" height="13" rx="2" />
        <path d="M16 8h4l3 3v4h-7V8zM5.5 18a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm13 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
      </svg>
    ),
    logoSubtitle: 'Traffic Control Center',
    welcomeTag: 'Welcome, Traffic Officer!',
    headline: 'Smart Traffic\nManagement for a',
    headlineAccent: 'Safer City',
    subText: 'Monitor live traffic feeds, manage congestion, coordinate signals and keep the city moving efficiently.',
    features: [
      { icon: <FiActivity size={16} />, title: 'Live Traffic Feed', desc: 'Real-time camera & sensor data' },
      { icon: <FiBell size={16} />, title: 'Incident Alerts', desc: 'Instant notifications for accidents' },
      { icon: <FiMapPin size={16} />, title: 'Route Management', desc: 'Smart route suggestions & control' },
      { icon: <FiBarChart2 size={16} />, title: 'Analytics', desc: 'Traffic trends and reports' },
    ],
    footerText: '© 2025 SmartCity Traffic Portal. All rights reserved.',
    roleName: 'Traffic Officer',
  },
}

/* ─── Role icon SVGs for the login card header ───────────────── */
const RoleIconBadge: React.FC<{ role: string; accentHex: string }> = ({ role, accentHex }) => {
  const size = 52
  const iconMap: Record<string, React.ReactNode> = {
    admin: (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="26" fill={accentHex} fillOpacity={0.15} />
        <path d="M26 12L14 18v8c0 7.5 5.25 14.5 12 16 6.75-1.5 12-8.5 12-16v-8L26 12z" stroke={accentHex} strokeWidth={2} fill="none" />
        <circle cx="26" cy="26" r="4" fill={accentHex} />
      </svg>
    ),
    citizen: (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="26" fill={accentHex} fillOpacity={0.15} />
        <circle cx="26" cy="21" r="6" stroke={accentHex} strokeWidth={2} />
        <path d="M14 38c0-5.5 5.4-10 12-10s12 4.5 12 10" stroke={accentHex} strokeWidth={2} strokeLinecap="round" />
        <path d="M20 40c1.5 0.5 3.5 1 6 1s4.5-0.5 6-1" stroke={accentHex} strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    police: (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="26" fill={accentHex} fillOpacity={0.15} />
        <path d="M26 12L14 18v8c0 7.5 5.25 14.5 12 16 6.75-1.5 12-8.5 12-16v-8L26 12z" stroke={accentHex} strokeWidth={2} fill="none" />
        <circle cx="26" cy="26" r="7" stroke={accentHex} strokeWidth={1.5} fill="none" />
        <path d="M23 26l2 2 4-4" stroke={accentHex} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    fire_service: (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="26" fill={accentHex} fillOpacity={0.15} />
        <path d="M26 14C22 20 18 23 18 28a8 8 0 0016 0c0-5-4-8-8-14z" stroke={accentHex} strokeWidth={2} fill="none" />
        <path d="M26 30c0 2-1.5 3-3 3" stroke={accentHex} strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    emergency: (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="26" fill={accentHex} fillOpacity={0.15} />
        <path d="M26 16v12M26 32h.01" stroke={accentHex} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx="26" cy="26" r="13" stroke={accentHex} strokeWidth={2} />
      </svg>
    ),
    traffic_officer: (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <circle cx="26" cy="26" r="26" fill={accentHex} fillOpacity={0.15} />
        <rect x="13" y="19" width="16" height="12" rx="2" stroke={accentHex} strokeWidth={2} />
        <path d="M29 24h5l3 3v4h-8v-7z" stroke={accentHex} strokeWidth={2} />
        <circle cx="18" cy="33" r="2" stroke={accentHex} strokeWidth={1.5} />
        <circle cx="34" cy="33" r="2" stroke={accentHex} strokeWidth={1.5} />
      </svg>
    ),
  }
  return <div className="flex items-center justify-center mb-2">{iconMap[role] ?? iconMap.admin}</div>
}

/* ─── Logo icon circle ───────────────────────────────────────── */
const LogoBadge: React.FC<{ config: RoleConfig }> = ({ config }) => (
  <div
    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
    style={{ background: `${config.accentHex}22`, border: `1px solid ${config.accentHex}44`, color: config.accentHex }}
  >
    {config.logoIcon}
  </div>
)

/* ─── Feature list item ──────────────────────────────────────── */
const Feature: React.FC<{ icon: React.ReactNode; title: string; desc: string; accentHex: string }> = ({ icon, title, desc, accentHex }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: `${accentHex}18`, color: accentHex }}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-gray-400 leading-snug">{desc}</p>
    </div>
  </div>
)

/* ─── Main Login Component ───────────────────────────────────── */
export default function Login() {
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') || 'citizen'
  const config = roleConfigs[role] ?? roleConfigs.citizen

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login, loading } = useAuth()

  const {
    isConfigured: googleConfigured,
    googleLoading,
    googleError,
    handleGoogleSuccess,
    handleGoogleError,
    clearGoogleError,
  } = useGoogleAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  const inputCls = `w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm
    placeholder-gray-500 focus:outline-none transition-all`
  const inputFocusCls = `focus:border-[var(--accent)] focus:bg-white/8`

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden"
      style={{ background: '#060e1a' }}
    >
      {/* ── Background image ── */}
      <div className="absolute inset-0 z-0">
        <img
          src={config.bg}
          alt=""
          className="w-full h-full object-cover object-center opacity-60"
        />
        {/* dark overlay — heavier on left side */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(4,10,24,0.97) 0%, rgba(4,10,24,0.85) 35%, rgba(4,10,24,0.3) 65%, rgba(4,10,24,0.15) 100%)' }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Logo row */}
        <div className="px-8 pt-7 flex items-center gap-3">
          <LogoBadge config={config} />
          <div>
            <p className="font-bold text-lg leading-tight">
              <span className="text-white">Smart</span>
              <span style={{ color: config.accentHex }}>City</span>
            </p>
            <p className="text-xs text-gray-400 leading-none">{config.logoSubtitle}</p>
          </div>
        </div>

        {/* Main body */}
        <div className="flex-1 flex items-center px-8 py-10">
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-10 items-center">

            {/* ── LEFT: branding & features ── */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-sm"
            >
              {config.welcomeTag && (
                <p className="text-sm font-semibold mb-3" style={{ color: config.accentHex }}>
                  {config.welcomeTag}
                </p>
              )}

              <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-1 whitespace-pre-line">
                {config.headline}
              </h1>
              <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight mb-3" style={{ color: config.accentHex }}>
                {config.headlineAccent}
              </h1>

              <div className="w-12 h-0.5 mb-5 rounded-full" style={{ background: config.accentHex }} />

              <p className="text-gray-300 text-sm leading-relaxed mb-8">{config.subText}</p>

              {/* Features */}
              <div className="space-y-4">
                {config.features.map((f) => (
                  <Feature key={f.title} icon={f.icon} title={f.title} desc={f.desc} accentHex={config.accentHex} />
                ))}
              </div>

              {/* Quote or hotline */}
              {config.hotline && (
                <div className="mt-8 flex items-center gap-4 rounded-xl p-4"
                  style={{ background: `${config.accentHex}14`, border: `1px solid ${config.accentHex}30` }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${config.accentHex}22`, color: config.accentHex }}>
                    <FiPhone size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{config.hotline.label}</p>
                    <p className="text-2xl font-extrabold" style={{ color: config.accentHex }}>{config.hotline.number}</p>
                    <p className="text-xs text-gray-400">{config.hotline.note}</p>
                  </div>
                </div>
              )}

              {config.quote && (
                <div className="mt-8 rounded-xl p-4"
                  style={{ background: `${config.accentHex}10`, border: `1px solid ${config.accentHex}25` }}>
                  <p className="text-sm font-semibold text-white whitespace-pre-line">{config.quote}</p>
                  {config.quoteSource && (
                    <p className="text-xs text-gray-400 mt-1">
                      {config.quoteSource.includes('SmartCity') ? (
                        <>
                          {config.quoteSource.replace('SmartCity', '')}
                          <span style={{ color: config.accentHex }}>SmartCity</span>
                          {config.quoteSource.endsWith('SmartCity.') ? '.' : ''}
                        </>
                      ) : config.quoteSource}
                    </p>
                  )}
                </div>
              )}
            </motion.div>

            {/* ── Spacer ── */}
            <div className="hidden lg:block" />

            {/* ── RIGHT: login card ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="w-full max-w-md mx-auto lg:mx-0"
            >
              <div
                className="rounded-2xl p-8 shadow-2xl"
                style={{
                  background: 'rgba(8, 16, 32, 0.82)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.09)',
                }}
              >
                {/* Back link */}
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
                >
                  <FiArrowLeft size={14} /> Back to role selection
                </button>

                {/* Card header */}
                <div className="text-center mb-7">
                  <RoleIconBadge role={role} accentHex={config.accentHex} />
                  <h2 className="text-2xl font-extrabold text-white mt-2">
                    {config.roleName}{' '}
                    <span style={{ color: config.accentHex }}>Login</span>
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm"
                  >
                    <FiAlertCircle size={15} /> {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Username */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5 font-medium">Username</label>
                    <div className="relative">
                      <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`${inputCls} ${inputFocusCls}`}
                        style={{ '--accent': config.accentHex } as React.CSSProperties}
                        placeholder="Enter username"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5 font-medium">Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputCls} ${inputFocusCls} pr-11`}
                        style={{ '--accent': config.accentHex } as React.CSSProperties}
                        placeholder="Enter password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: config.accentHex }}
                      />
                      <span className="text-sm text-gray-300">Remember me</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm transition-colors hover:opacity-80"
                      style={{ color: config.accentHex }}
                    >
                      Forgot Password?
                    </Link>
                  </div>

                  {/* Sign In button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl text-sm transition-all mt-1 disabled:opacity-50"
                    style={{
                      background: loading
                        ? `${config.accentHex}80`
                        : `linear-gradient(to right, ${config.accentHex}, ${config.accentHex}cc)`,
                      boxShadow: `0 4px 20px ${config.accentHex}40`,
                    }}
                  >
                    {loading ? 'Signing in...' : <>Sign In <FiArrowLeft className="rotate-180" size={14} /></>}
                  </button>

                  {/* OR divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-gray-500">OR</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Google sign-in */}
                  {googleError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs"
                    >
                      <FiAlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span className="flex-1">{googleError}</span>
                      <button type="button" onClick={clearGoogleError} className="shrink-0 hover:text-red-300">✕</button>
                    </motion.div>
                  )}

                  {googleLoading && (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400">
                      <FiLoader size={15} className="animate-spin text-cyan-400" />
                      Signing in with Google…
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
                        text="signin_with"
                        logo_alignment="left"
                      />
                    </div>
                  )}

                  {!googleLoading && !googleConfigured && (
                    <div className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-500 text-xs font-medium py-3 rounded-xl cursor-not-allowed select-none">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 opacity-40" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Google sign-in not configured
                    </div>
                  )}

                  {/* Sign up link — only for citizen role */}
                  {role === 'citizen' && (
                    <p className="text-center text-sm text-gray-400 pt-1">
                      Don't have an account?{' '}
                      <Link
                        to={`/register?role=${role}`}
                        className="font-semibold transition-colors hover:opacity-80"
                        style={{ color: config.accentHex }}
                      >
                        Sign up
                      </Link>
                    </p>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="relative z-10 px-8 py-4 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <div className="w-5 h-5 rounded flex items-center justify-center"
              style={{ background: `${config.accentHex}20`, color: config.accentHex }}>
              <FiShield size={11} />
            </div>
            {config.footerText}
          </div>
          <div className="flex items-center gap-4 text-gray-500 text-xs">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Help</a>
          </div>
        </footer>
      </div>
    </div>
  )
}
