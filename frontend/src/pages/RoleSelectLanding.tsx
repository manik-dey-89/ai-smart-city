import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FiArrowRight,
  FiPlay,
  FiUsers,
  FiServer,
  FiActivity,
  FiCheckCircle,
  FiMap,
  FiDroplet,
  FiWind,
  FiTrash2,
  FiPhone,
  FiAlertCircle,
  FiSun,
  FiMoon,
  FiChevronRight,
  FiSmartphone,
} from 'react-icons/fi'
import { FaCar } from 'react-icons/fa'

/* ─── Floating status widget ─────────────────────────────────── */
interface FloatingWidgetProps {
  icon: React.ReactNode
  title: string
  value: string
  sub: string
  color: string
  className?: string
  delay?: number
}

const FloatingWidget: React.FC<FloatingWidgetProps> = ({
  icon, title, value, sub, color, className = '', delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className={`absolute backdrop-blur-md bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[170px] ${className}`}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
      <span className="text-xs text-gray-400 font-medium">{title}</span>
    </div>
    <p className="text-white font-bold text-base leading-tight">{value}</p>
    <p className="text-gray-400 text-xs mt-0.5">{sub}</p>
  </motion.div>
)

/* ─── Service card ────────────────────────────────────────────── */
interface ServiceCardProps {
  icon: React.ReactNode
  img: string
  title: string
  description: string
  color: string
  to: string
  delay?: number
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  icon, img, title, description, color, to, delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.4 }}
    className="group relative bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:bg-[#0d1b2a] transition-all duration-300 overflow-hidden"
  >
    {/* background glow */}
    <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity ${color.replace('text-', 'bg-')}`} />

    <div className={`inline-flex p-3 rounded-xl mb-4 ${color.replace('text-', 'bg-').replace('400', '500/15')}`}>
      <span className={color}>{icon}</span>
    </div>

    <div className="flex items-end justify-between">
      <div className="flex-1 pr-4">
        <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
        <Link
          to={to}
          className={`inline-flex items-center gap-1 mt-4 text-sm font-medium ${color} hover:opacity-80 transition-opacity`}
        >
          Learn More <FiArrowRight size={14} />
        </Link>
      </div>
      <img
        src={img}
        alt={title}
        className="w-20 h-20 object-contain opacity-90 group-hover:scale-110 transition-transform duration-300 shrink-0"
      />
    </div>
  </motion.div>
)

/* ─── Stat counter ────────────────────────────────────────────── */
interface StatProps {
  value: string
  label: string
  icon: React.ReactNode
  color: string
}

const Stat: React.FC<StatProps> = ({ value, label, icon, color }) => (
  <div className="flex flex-col items-center gap-1">
    <span className={`${color} mb-1`}>{icon}</span>
    <span className="text-2xl font-extrabold text-white">{value}</span>
    <span className="text-xs text-gray-400 text-center">{label}</span>
  </div>
)

/* ─── Animated Demo Component ────────────────────────────────── */
const WORKFLOW_STEPS = [
  {
    step: 1, icon: '🏙', title: 'Citizen Opens Dashboard',
    desc: 'Real-time weather, AQI, traffic and flood data loads instantly from live APIs.',
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30',
    metrics: [
      { label: 'Temp', val: '32°C', color: 'text-yellow-400' },
      { label: 'AQI', val: '42', color: 'text-green-400' },
      { label: 'Traffic', val: 'Light', color: 'text-lime-400' },
    ],
  },
  {
    step: 2, icon: '🚨', title: 'Emergency SOS Submitted',
    desc: 'Citizen selects emergency type, GPS location auto-detected, SOS sent to Smart City system.',
    color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30',
    metrics: [
      { label: 'Type', val: 'Medical', color: 'text-red-400' },
      { label: 'Priority', val: 'High', color: 'text-orange-400' },
      { label: 'Status', val: 'Reported', color: 'text-yellow-400' },
    ],
  },
  {
    step: 3, icon: '⚖️', title: 'Admin Reviews & Routes',
    desc: 'Admin Command Center receives the case, verifies, then approves and auto-routes it by type.',
    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30',
    metrics: [
      { label: 'Action', val: 'Approved', color: 'text-green-400' },
      { label: 'Routed', val: 'Emergency', color: 'text-purple-400' },
      { label: 'Dept', val: 'Response', color: 'text-cyan-400' },
    ],
  },
  {
    step: 4, icon: '🚑', title: 'Officer Responds',
    desc: 'Emergency Responder receives case, views GPS location on map, dispatches team with ETA.',
    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30',
    metrics: [
      { label: 'Status', val: 'En Route', color: 'text-cyan-400' },
      { label: 'ETA', val: '8 min', color: 'text-yellow-400' },
      { label: 'Team', val: 'Assigned', color: 'text-green-400' },
    ],
  },
  {
    step: 5, icon: '📍', title: 'Citizen Tracks in Real-Time',
    desc: 'Citizen enters their Case ID and watches live status updates — Reported → Assigned → Resolved.',
    color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30',
    metrics: [
      { label: 'Case ID', val: 'CMP-2026', color: 'text-cyan-400' },
      { label: 'Updates', val: '3 events', color: 'text-blue-400' },
      { label: 'Result', val: 'Resolved', color: 'text-green-400' },
    ],
  },
]

const FEATURES_STRIP = [
  { icon: '🚗', label: 'AI Traffic', color: 'text-orange-400' },
  { icon: '💨', label: 'Air Quality', color: 'text-green-400' },
  { icon: '☁️', label: 'Weather', color: 'text-blue-400' },
  { icon: '🌊', label: 'Flood Alert', color: 'text-cyan-400' },
  { icon: '📋', label: 'Complaints', color: 'text-yellow-400' },
  { icon: '🚨', label: 'Emergency', color: 'text-red-400' },
  { icon: '🗺', label: 'City Map', color: 'text-indigo-400' },
  { icon: '🌾', label: 'AgriHub', color: 'text-emerald-400' },
]

const DemoAnimation: React.FC = () => {
  const [activeStep, setActiveStep] = React.useState(0)
  const [animating, setAnimating] = React.useState(true)

  React.useEffect(() => {
    if (!animating) return
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % WORKFLOW_STEPS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [animating])

  const step = WORKFLOW_STEPS[activeStep]

  return (
    <div className="p-6 space-y-5">
      {/* Feature strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FEATURES_STRIP.map(f => (
          <div key={f.label} className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-9 h-9 bg-white/5 border border-white/8 rounded-xl flex items-center justify-center text-base">{f.icon}</div>
            <span className={`text-[9px] font-medium ${f.color}`}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Main workflow display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: step list */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">Platform Workflow</p>
          {WORKFLOW_STEPS.map((s, i) => (
            <button key={s.step} onClick={() => { setActiveStep(i); setAnimating(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                activeStep === i ? `${s.bg} ${s.border}` : 'bg-white/3 border-white/5 hover:border-white/15'
              }`}>
              <span className={`text-lg shrink-0 ${activeStep === i ? '' : 'opacity-40'}`}>{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${activeStep === i ? s.color : 'text-gray-400'}`}>
                  Step {s.step}: {s.title}
                </p>
              </div>
              {activeStep === i && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`w-2 h-2 rounded-full shrink-0 ${s.color.replace('text-', 'bg-')} animate-pulse`}
                />
              )}
            </button>
          ))}
        </div>

        {/* Right: animated detail */}
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className={`rounded-2xl border p-5 flex flex-col gap-4 ${step.bg} ${step.border}`}
        >
          {/* Step icon + title */}
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-4xl">{step.icon}
            </motion.div>
            <div>
              <p className={`text-sm font-extrabold ${step.color}`}>Step {step.step}</p>
              <p className="text-base font-bold text-white leading-tight">{step.title}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-300 leading-relaxed">{step.desc}</p>

          {/* Animated metrics */}
          <div className="grid grid-cols-3 gap-2">
            {step.metrics.map((m, i) => (
              <motion.div key={m.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="bg-black/20 rounded-xl p-2.5 text-center">
                <p className={`text-sm font-extrabold ${m.color}`}>{m.val}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{m.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
              <span>Workflow Progress</span>
              <span>{activeStep + 1} / {WORKFLOW_STEPS.length}</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${step.color.replace('text-', 'bg-')}`}
                initial={{ width: 0 }}
                animate={{ width: `${((activeStep + 1) / WORKFLOW_STEPS.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {WORKFLOW_STEPS.map((_, i) => (
            <button key={i} onClick={() => { setActiveStep(i); setAnimating(false); }}
              className={`rounded-full transition-all ${activeStep === i ? 'w-5 h-2 bg-cyan-400' : 'w-2 h-2 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
        <button onClick={() => setAnimating(a => !a)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
            animating ? 'bg-white/10 border-white/20 text-white' : 'bg-green-500/15 border-green-500/30 text-green-400'
          }`}>
          {animating ? (
            <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
          ) : (
            <><FiPlay size={11}/> Auto Play</>
          )}
        </button>
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────── */
export default function RoleSelectLanding() {
  const [darkMode, setDarkMode] = useState(true)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const navigate = useNavigate()  // used via setShowRoleModal → login redirect
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void navigate

  const NAV_LINK_MAP: Record<string, string> = {
    Home:       '/',
    Features:   '/features',
    Services:   '/services',
    'About Us': '/about',
    Contact:    '/contact',
  }

  const services: ServiceCardProps[] = [
    {
      icon: <FaCar size={22} />,
      img: '/illustrations/01_traffic_illustration.png',
      title: 'Traffic Management',
      description: 'Real-time traffic updates, congestion alerts and smart route suggestions.',
      color: 'text-orange-400',
      to: '/login?role=traffic_officer',
      delay: 0,
    },
    {
      icon: <FiDroplet size={22} />,
      img: '/illustrations/02_water_level_illustration.png',
      title: 'Water Level Monitoring',
      description: 'Monitor water levels in rivers, lakes and reservoirs in real-time.',
      color: 'text-cyan-400',
      to: '/login?role=admin',
      delay: 0.05,
    },
    {
      icon: <FiWind size={22} />,
      img: '/illustrations/03_air_quality_aqi_illustration.png',
      title: 'Air Quality Index',
      description: 'Check real-time AQI, pollution levels and get health recommendations.',
      color: 'text-green-400',
      to: '/login?role=citizen',
      delay: 0.1,
    },
    {
      icon: <FiTrash2 size={22} />,
      img: '/illustrations/04_garbage_truck_illustration.png',
      title: 'Garbage Management',
      description: 'Track garbage collection schedules and manage waste efficiently.',
      color: 'text-purple-400',
      to: '/login?role=admin',
      delay: 0.15,
    },
    {
      icon: <FiPhone size={22} />,
      img: '/illustrations/05_municipality_illustration.png',
      title: 'Municipality Contact',
      description: 'Find nearby municipality contacts for quick support and assistance.',
      color: 'text-blue-400',
      to: '/login?role=citizen',
      delay: 0.2,
    },
    {
      icon: <FiAlertCircle size={22} />,
      img: '/illustrations/06_emergency_alert_illustration.png',
      title: 'Emergency Services',
      description: 'Quick access to emergency contacts and important helpline numbers.',
      color: 'text-red-400',
      to: '/login?role=emergency',
      delay: 0.25,
    },
  ]

  const roles = [
    { label: 'Citizen', role: 'citizen', color: 'border-blue-500/50 hover:bg-blue-500/10', badge: 'text-blue-400' },
    { label: 'City Admin', role: 'admin', color: 'border-purple-500/50 hover:bg-purple-500/10', badge: 'text-purple-400' },
    { label: 'Traffic Officer', role: 'traffic_officer', color: 'border-orange-500/50 hover:bg-orange-500/10', badge: 'text-orange-400' },
    { label: 'Police', role: 'police', color: 'border-red-500/50 hover:bg-red-500/10', badge: 'text-red-400' },
    { label: 'Fire Service', role: 'fire_service', color: 'border-yellow-500/50 hover:bg-yellow-500/10', badge: 'text-yellow-400' },
    { label: 'Emergency Responder', role: 'emergency', color: 'border-green-500/50 hover:bg-green-500/10', badge: 'text-green-400' },
  ]

  return (
    <div className="min-h-screen bg-[#070f1a] text-white overflow-x-hidden">

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 backdrop-blur-md bg-[#070f1a]/70 border-b border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-green-400 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-black" stroke="currentColor" strokeWidth={2}>
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-lg text-white">SmartCity</span>
            <p className="text-[10px] text-gray-400 leading-none">Building a Better Tomorrow</p>
          </div>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          {['Home', 'Features', 'Services', 'Dashboard', 'About Us', 'Contact'].map((item, i) => {
            if (item === 'Dashboard') return (
              <button key={item}
                onClick={() => setShowRoleModal(true)}
                className="text-gray-300 hover:text-white transition-colors">
                {item}
              </button>
            )
            return (
              <Link
                key={item}
                to={NAV_LINK_MAP[item] ?? '/'}
                className={`transition-colors ${i === 0 ? 'text-green-400 border-b-2 border-green-400 pb-0.5' : 'text-gray-300 hover:text-white'}`}
              >
                {item}
              </Link>
            )
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            {darkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          <button
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-5 py-2 rounded-full transition-all"
          >
            Get Started <FiArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">

        {/* Background city illustration */}
        <div className="absolute inset-0 z-0">
          <img
            src="/illustrations/01_background_city_scene.png"
            alt="Smart City"
            className="absolute right-0 top-0 h-full w-[60%] object-cover object-left opacity-90"
            style={{ maskImage: 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.2) 20%, black 55%)', WebkitMaskImage: 'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.2) 20%, black 55%)' }}
          />
          {/* radial glow */}
          <div className="absolute top-1/3 right-1/3 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#070f1a] to-transparent" />
        </div>

        {/* Left hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 w-full">
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 mb-6"
            >
              <span className="text-green-400 text-sm font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                Sustainable
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-300 text-sm">Intelligent</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-300 text-sm">Connected</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6"
            >
              Smarter City.<br />
              Better{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                Tomorrow.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-gray-400 text-lg leading-relaxed mb-8 max-w-md"
            >
              Real-time monitoring and intelligent management solutions for a cleaner, safer and sustainable city.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-center gap-4 flex-wrap"
            >
              <button
                onClick={() => setShowRoleModal(true)}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3 rounded-full text-base transition-all shadow-lg shadow-green-500/20"
              >
                Explore Dashboard <FiArrowRight size={16} />
              </button>
              <button
                onClick={() => setShowVideo(true)}
                className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-medium px-6 py-3 rounded-full text-base transition-all">
                <FiPlay size={14} className="text-green-400" /> Watch Video
              </button>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 border-t border-white/10 pt-8"
            >
              <Stat value="1.2M+" label="Citizens Connected" icon={<FiUsers size={18} />} color="text-cyan-400" />
              <Stat value="50+" label="Smart Services" icon={<FiServer size={18} />} color="text-green-400" />
              <Stat value="120+" label="Monitoring Points" icon={<FiActivity size={18} />} color="text-purple-400" />
              <Stat value="99.9%" label="System Uptime" icon={<FiCheckCircle size={18} />} color="text-orange-400" />
            </motion.div>
          </div>
        </div>

        {/* Floating info widgets */}
        <div className="hidden lg:block">
          {/* Traffic widget */}
          <FloatingWidget
            icon={<FaCar size={14} />}
            title="Traffic Conditions"
            value="Moderate Traffic"
            sub="Majomiri Road"
            color="bg-orange-500/20 text-orange-400"
            className="top-32 right-[42%]"
            delay={0.6}
          />
          {/* Air Quality */}
          <FloatingWidget
            icon={<FiWind size={14} />}
            title="Air Quality"
            value="Good"
            sub="AQI 42"
            color="bg-green-500/20 text-green-400"
            className="top-24 right-[22%]"
            delay={0.7}
          />
          {/* Water Level */}
          <FloatingWidget
            icon={<FiDroplet size={14} />}
            title="Water Level"
            value="Normal"
            sub="Hooghly River"
            color="bg-cyan-500/20 text-cyan-400"
            className="top-44 right-[5%]"
            delay={0.8}
          />
          {/* Garbage Status */}
          <FloatingWidget
            icon={<FiTrash2 size={14} />}
            title="Garbage Status"
            value="On Schedule"
            sub="Collection Today"
            color="bg-purple-500/20 text-purple-400"
            className="top-[300px] right-[4%]"
            delay={0.9}
          />
          {/* Live City Map mini card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.4 }}
            className="absolute top-[420px] right-[38%] backdrop-blur-md bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-4 shadow-2xl w-48"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                <FiMap size={13} className="text-cyan-400" /> Live City Map
              </span>
              <FiArrowRight size={12} className="text-gray-500" />
            </div>
            <div className="h-20 rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                <div className="w-full h-full" style={{
                  backgroundImage: `radial-gradient(circle, rgba(6,182,212,0.4) 1px, transparent 1px)`,
                  backgroundSize: '14px 14px'
                }} />
              </div>
              {/* map dots */}
              {[
                { top: '30%', left: '40%', c: 'bg-red-400' },
                { top: '60%', left: '55%', c: 'bg-cyan-400' },
                { top: '45%', left: '25%', c: 'bg-green-400' },
                { top: '70%', left: '70%', c: 'bg-orange-400' },
              ].map((d, i) => (
                <span key={i} className={`absolute w-2.5 h-2.5 ${d.c} rounded-full shadow-lg`} style={{ top: d.top, left: d.left }} />
              ))}
            </div>
          </motion.div>
          {/* Nearby Municipality */}
          <FloatingWidget
            icon={<FiPhone size={14} />}
            title="Nearby Municipality"
            value="Kolkata Municipal Corp."
            sub="2.5 km away • 033 1234 5678"
            color="bg-blue-500/20 text-blue-400"
            className="top-[430px] right-[4%]"
            delay={1.1}
          />
        </div>
      </section>

      {/* ── SERVICES GRID ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-extrabold mb-3">City Services at a Glance</h2>
          <p className="text-gray-400">Everything you need to manage and monitor your city in one place</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <ServiceCard key={s.title} {...s} />
          ))}
        </div>
      </section>

      {/* ── AGRIHUB SECTION ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #052e16 0%, #0d1b2a 40%, #052e16 100%)',
            border: '1px solid rgba(34,197,94,0.25)',
          }}
        >
          {/* Background glow */}
          <div className="absolute -top-20 left-1/4 w-[400px] h-[300px] bg-green-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 right-1/4 w-[300px] h-[250px] bg-emerald-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10 p-10">
            {/* Left: Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-4">
                <div className="w-14 h-14 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">🌾</span>
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-white">
                    AgriHub
                    <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 align-middle">
                      Smart Farming
                    </span>
                  </h3>
                  <p className="text-green-400 text-sm font-medium">Integrated Agricultural Intelligence Platform</p>
                </div>
              </div>

              <p className="text-gray-300 text-base leading-relaxed mb-6 max-w-xl">
                A dedicated smart farming portal for farmers and agricultural stakeholders —
                featuring crop recommendations, live market prices, government schemes,
                marketplace for buying &amp; selling produce, and expert advisory services.
              </p>

              {/* Feature badges */}
              <div className="flex flex-wrap gap-2 mb-8 justify-center lg:justify-start">
                {[
                  '🌱 Crop Management',
                  '📊 Mandi Prices',
                  '🛒 Marketplace',
                  '🏛 Govt Schemes',
                  '💬 Expert Q&A',
                  '🤖 AI Recommender',
                ].map(f => (
                  <span key={f}
                    className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 font-medium">
                    {f}
                  </span>
                ))}
              </div>

              {/* CTA Button */}
              <a
                href="https://agrihub-portal.onrender.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-400 text-black font-extrabold px-8 py-4 rounded-full text-base transition-all shadow-xl shadow-green-500/25 hover:shadow-green-400/30 hover:scale-105"
              >
                <span className="text-xl">🌾</span>
                Get Started with AgriHub
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </a>
              <p className="text-xs text-gray-500 mt-3">Opens AgriHub Portal · Free for all farmers</p>
            </div>

            {/* Right: Stats cards */}
            <div className="shrink-0 grid grid-cols-2 gap-3 w-full lg:w-64">
              {[
                { icon:'🌾', label:'Crop Types',      val:'50+',  color:'text-green-400'  },
                { icon:'📊', label:'Mandi Markets',   val:'15+',  color:'text-yellow-400' },
                { icon:'🏛', label:'Govt Schemes',    val:'6',    color:'text-blue-400'   },
                { icon:'🤖', label:'AI Reco Engine',  val:'Free', color:'text-purple-400' },
              ].map(({ icon, label, val, color }) => (
                <div key={label}
                  className="bg-black/20 border border-white/8 rounded-2xl p-4 text-center backdrop-blur-sm">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className={`text-xl font-extrabold ${color}`}>{val}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── MOBILE APP CTA ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative bg-gradient-to-r from-[#0d1b2a] via-[#0e2235] to-[#0d1b2a] border border-white/10 rounded-3xl p-10 overflow-hidden flex flex-col lg:flex-row items-center gap-10"
        >
          {/* glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Phone icon */}
          <div className="shrink-0 w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center">
            <FiSmartphone size={28} className="text-green-400" />
          </div>

          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <h3 className="text-2xl font-extrabold mb-1">
              All Smart City Services{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                In Your Pocket
              </span>
            </h3>
            <p className="text-gray-400 text-sm">
              Access all smart city services, real-time alerts and important contacts on the go.
            </p>
          </div>

          {/* Store buttons */}
          <div className="shrink-0 flex gap-3">
            <a href="#" className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-5 py-3 rounded-xl transition-all">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M3.18 23.24c.37.21.8.21 1.17 0L14.7 17.1l-2.96-2.96-8.56 9.1zM.05 1.55C.02 1.7 0 1.85 0 2v20c0 .15.02.3.05.44l11.46-11.46L.05 1.55zm19.7 8.38-2.94-1.67-3.3 3.3 3.3 3.3 2.97-1.69c.85-.48.85-1.76-.03-2.24zM4.35.76 14.7 6.9l-2.96 2.96L3.18.76c.37-.21.8-.21 1.17 0z" />
              </svg>
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-none">COMING SOON</p>
                <p className="text-xs font-semibold text-white">Google Play</p>
              </div>
            </a>
            <a href="#" className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-5 py-3 rounded-xl transition-all">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide leading-none">COMING SOON</p>
                <p className="text-xs font-semibold text-white">App Store</p>
              </div>
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── ANIMATED DEMO MODAL ──────────────────────────── */}
      {showVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
          onClick={() => setShowVideo(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'rgba(8,16,32,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-green-400 rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={2.5} className="w-4 h-4">
                    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-white text-sm">SmartCity Platform Demo</p>
                  <p className="text-[10px] text-gray-500">Interactive workflow overview</p>
                </div>
              </div>
              <button onClick={() => setShowVideo(false)} className="text-gray-500 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Animated demo content */}
            <DemoAnimation />

            <div className="px-6 py-3 border-t border-white/8 flex items-center justify-between">
              <p className="text-[10px] text-gray-600">SmartCity Dashboard · Real-time Urban Intelligence Platform</p>
              <button onClick={() => setShowVideo(false)} className="text-xs text-gray-400 hover:text-white px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all">
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── ROLE SELECT MODAL ─────────────────────────────────── */}
      {showRoleModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setShowRoleModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="bg-[#0d1b2a] border border-white/10 rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-1 text-white">Select Your Role</h2>
            <p className="text-gray-400 text-sm mb-6">Choose your role to access the dashboard</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {roles.map(({ label, role, color, badge }) => (
                <Link
                  key={role}
                  to={`/login?role=${role}`}
                  className={`group flex items-center justify-between border ${color} rounded-xl px-4 py-3 transition-all`}
                >
                  <span className={`font-semibold text-sm ${badge}`}>{label}</span>
                  <FiChevronRight size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                </Link>
              ))}
            </div>
            <button
              onClick={() => setShowRoleModal(false)}
              className="mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
