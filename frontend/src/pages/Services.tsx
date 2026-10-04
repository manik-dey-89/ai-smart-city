import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FiTruck, FiWind, FiCloud, FiDroplet, FiTrash2, FiMessageSquare,
  FiAlertOctagon, FiMap, FiArrowRight, FiCheck, FiUsers,
  FiShield, FiActivity, FiNavigation, FiSearch, FiSun,
} from 'react-icons/fi'
import PublicNavbar from '../components/PublicNavbar'
import PublicFooter from '../components/PublicFooter'

const CATEGORIES = ['All', 'Citizens', 'Officers', 'Administration', 'Emergency']

interface Service {
  icon: React.ElementType
  color: string
  bg: string
  glow: string
  title: string
  desc: string
  features: string[]
  role: string
  loginRole: string
  category: string[]
  badge?: string
  externalLink?: string
}

const SERVICES: Service[] = [
  {
    icon: FiTruck, color: 'text-orange-400', bg: 'bg-orange-500/10', glow: 'shadow-orange-500/20',
    title: 'Traffic Intelligence',
    desc: 'Real-time congestion monitoring, AI route planning and incident tracking for every major road in the city.',
    features: ['Live congestion maps', 'OSRM turn-by-turn routing', 'Incident alerts', 'Travel time ETA'],
    role: 'Available to all roles',
    loginRole: 'citizen',
    category: ['All', 'Citizens', 'Officers'],
    badge: 'AI Powered',
  },
  {
    icon: FiWind, color: 'text-green-400', bg: 'bg-green-500/10', glow: 'shadow-green-500/20',
    title: 'Air Quality Monitor',
    desc: 'Hyperlocal AQI readings updated every 10 minutes with health recommendations based on WHO guidelines.',
    features: ['US EPA AQI index', 'PM2.5 / PM10 levels', 'Health advisories', 'Trend charts'],
    role: 'Available to Citizens & Admins',
    loginRole: 'citizen',
    category: ['All', 'Citizens'],
  },
  {
    icon: FiCloud, color: 'text-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-blue-500/20',
    title: 'Weather Services',
    desc: '7-day forecast with hourly breakdown, precipitation prediction and severe weather alerts.',
    features: ['7-day forecast', 'Hourly precipitation', 'Wind & humidity', 'Weather-traffic impact'],
    role: 'Available to all roles',
    loginRole: 'citizen',
    category: ['All', 'Citizens'],
  },
  {
    icon: FiDroplet, color: 'text-cyan-400', bg: 'bg-cyan-500/10', glow: 'shadow-cyan-500/20',
    title: 'Water & Flood Alert',
    desc: 'Live water level monitoring across rivers, reservoirs and drainage networks with flood risk assessment.',
    features: ['River level monitoring', 'Flood risk zones', 'Early warning alerts', 'Drainage status'],
    role: 'Citizens & Emergency Services',
    loginRole: 'citizen',
    category: ['All', 'Citizens', 'Emergency'],
  },
  {
    icon: FiTrash2, color: 'text-purple-400', bg: 'bg-purple-500/10', glow: 'shadow-purple-500/20',
    title: 'Waste Management',
    desc: 'Smart bin monitoring, collection scheduling and route optimisation for a cleaner city.',
    features: ['Smart bin fill levels', 'Collection schedules', 'Route optimisation', 'Zone analytics'],
    role: 'Municipal Officers & Admins',
    loginRole: 'admin',
    category: ['All', 'Officers', 'Administration'],
  },
  {
    icon: FiMessageSquare, color: 'text-yellow-400', bg: 'bg-yellow-500/10', glow: 'shadow-yellow-500/20',
    title: 'Complaint Centre',
    desc: 'Report civic issues with map pinning, evidence upload, and track every case with a unique CMP ID.',
    features: ['15+ complaint types', 'Map location picker', 'Evidence upload', 'CMP tracking ID', 'Real-time status'],
    role: 'All Citizens',
    loginRole: 'citizen',
    category: ['All', 'Citizens'],
    badge: 'New',
  },
  {
    icon: FiAlertOctagon, color: 'text-red-400', bg: 'bg-red-500/10', glow: 'shadow-red-500/20',
    title: 'Emergency Response',
    desc: 'Immediate emergency request submission with multi-agency dispatch and live response tracking.',
    features: ['One-tap emergency request', 'Multi-agency dispatch', 'Response tracking', 'Emergency contacts'],
    role: 'Citizens & Emergency Services',
    loginRole: 'emergency',
    category: ['All', 'Citizens', 'Emergency'],
  },
  {
    icon: FiMap, color: 'text-indigo-400', bg: 'bg-indigo-500/10', glow: 'shadow-indigo-500/20',
    title: 'City Map',
    desc: 'A unified geospatial dashboard showing all city assets, incidents, sensors and emergency stations live.',
    features: ['OpenStreetMap base layer', 'Real-time incident markers', 'Asset overlays', 'Flood zone layers'],
    role: 'All Roles',
    loginRole: 'citizen',
    category: ['All', 'Citizens', 'Officers', 'Administration'],
  },
  {
    icon: FiShield, color: 'text-rose-400', bg: 'bg-rose-500/10', glow: 'shadow-rose-500/20',
    title: 'Officer Case Panel',
    desc: 'Dedicated workflow panel for officers to receive, manage and resolve citizen-reported cases.',
    features: ['Routed case inbox', 'Status update & remarks', 'Evidence review', 'Full audit trail'],
    role: 'Police / Traffic / Fire / Emergency Officers',
    loginRole: 'police',
    category: ['All', 'Officers', 'Emergency'],
  },
  {
    icon: FiUsers, color: 'text-teal-400', bg: 'bg-teal-500/10', glow: 'shadow-teal-500/20',
    title: 'User & Role Management',
    desc: 'Create users, assign roles with granular permissions and manage access control across all city services.',
    features: ['Create / deactivate users', 'Role assignment', 'Permission management', 'Login history'],
    role: 'City Admin Only',
    loginRole: 'admin',
    category: ['All', 'Administration'],
  },
  {
    icon: FiActivity, color: 'text-pink-400', bg: 'bg-pink-500/10', glow: 'shadow-pink-500/20',
    title: 'Incident Management',
    desc: 'Track, assign and resolve incidents across the city with severity classification and response assignment.',
    features: ['Incident creation', 'Severity levels', 'Officer assignment', 'Resolution tracking'],
    role: 'City Admin',
    loginRole: 'admin',
    category: ['All', 'Administration', 'Emergency'],
  },
  {
    icon: FiNavigation, color: 'text-amber-400', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/20',
    title: 'Citizen Dashboard',
    desc: 'A personalised overview showing live weather, AQI, traffic status and access to all city services.',
    features: ['Live city data', 'Location search', 'Service quick links', '7-day forecast'],
    role: 'All Citizens',
    loginRole: 'citizen',
    category: ['All', 'Citizens'],
  },
  {
    icon: FiSun, color: 'text-green-400', bg: 'bg-green-500/10', glow: 'shadow-green-500/20',
    title: 'AgriHub — Smart Farming',
    desc: 'A dedicated agricultural intelligence portal for farmers — crop management, live mandi prices, government schemes, marketplace and AI-powered crop recommendations.',
    features: [
      'AI crop recommender engine',
      'Live mandi market prices',
      'Farmer-to-buyer marketplace',
      '6 real govt schemes (PM-KISAN, PMFBY…)',
      'Expert Q&A community',
      'Crop growth stage tracking',
    ],
    role: 'All Farmers & Citizens',
    loginRole: 'citizen',
    category: ['All', 'Citizens'],
    badge: 'External Portal',
    externalLink: 'https://agrihub-portal.onrender.com/',
  },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.4, delay },
})

export default function Services() {
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = SERVICES.filter(s =>
    s.category.includes(category) &&
    (search === '' || s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.desc.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-[#070f1a] text-white overflow-x-hidden">
      <PublicNavbar active="Services" />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-green-500/5 rounded-full blur-3xl" />
        </div>
        <motion.div {...fadeUp()} className="max-w-3xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold mb-6">
            <FiActivity size={13} /> City Services
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
            All Smart City Services{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
              In One Place
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            From real-time monitoring to citizen complaint management — every urban service, fully integrated and live.
          </p>
        </motion.div>
      </section>

      {/* ── Filters ───────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4
                         text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/40 transition-all" />
          </div>
          {/* Category pills */}
          <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border
                  ${category === c
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">{filtered.length} service{filtered.length !== 1 ? 's' : ''} found</p>
      </section>

      {/* ── Service grid ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FiSearch size={40} className="mx-auto mb-3 opacity-30" />
            <p>No services match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div key={s.title} {...fadeUp(0.04 * i)}
                  className={`group relative bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6
                              hover:border-white/20 hover:shadow-xl ${s.glow} transition-all duration-300 overflow-hidden`}>
                  {/* Glow blob */}
                  <div className={`absolute -bottom-10 -right-10 w-36 h-36 rounded-full blur-3xl opacity-5 group-hover:opacity-15 transition-opacity ${s.bg}`} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl ${s.bg}`}>
                        <Icon size={20} className={s.color} />
                      </div>
                      {s.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                          {s.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">{s.desc}</p>

                    <ul className="space-y-1.5 mb-5">
                      {s.features.slice(0, 4).map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs text-gray-300">
                          <FiCheck size={11} className={s.color} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <p className="text-[10px] text-gray-600">{s.role}</p>
                      {s.externalLink ? (
                        <a href={s.externalLink} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center gap-1 text-xs font-semibold ${s.color} hover:opacity-80 transition-opacity`}>
                          Get Started <FiArrowRight size={11} />
                        </a>
                      ) : (
                        <Link to={`/login?role=${s.loginRole}`}
                          className={`flex items-center gap-1 text-xs font-semibold ${s.color} hover:opacity-80 transition-opacity`}>
                          Access <FiArrowRight size={11} />
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Role guide ────────────────────────────────────── */}
      <section className="bg-white/3 border-y border-white/8 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-10">
            <h2 className="text-3xl font-extrabold mb-3">Access by Role</h2>
            <p className="text-gray-400">Sign in with the right role to unlock the services you need</p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { role: 'Citizen',          login: 'citizen',         color: 'border-blue-500/30  text-blue-400',   desc: 'Weather, AQI, Complaints, Emergency' },
              { role: 'City Admin',       login: 'admin',           color: 'border-purple-500/30 text-purple-400', desc: 'All modules + User management' },
              { role: 'Traffic Officer',  login: 'traffic_officer', color: 'border-orange-500/30 text-orange-400', desc: 'Traffic + Assigned cases' },
              { role: 'Police',           login: 'police',          color: 'border-red-500/30    text-red-400',    desc: 'Emergency + Criminal cases' },
              { role: 'Fire Service',     login: 'fire_service',    color: 'border-yellow-500/30 text-yellow-400', desc: 'Emergency + Fire cases' },
              { role: 'Emergency',        login: 'emergency',       color: 'border-green-500/30  text-green-400',  desc: 'Emergency response panel' },
            ].map(({ role, login, color, desc }) => (
              <motion.div key={role} {...fadeUp(0.05)}
                className={`border rounded-xl p-4 bg-[#0d1b2a]/60 hover:bg-[#0d1b2a] transition-all`}
                style={{ borderColor: color.split(' ')[0].replace('border-', '').replace('/30', '') }}>
                <p className={`text-sm font-bold mb-1 ${color.split(' ')[1]}`}>{role}</p>
                <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">{desc}</p>
                <Link to={`/login?role=${login}`}
                  className={`text-xs font-semibold ${color.split(' ')[1]} flex items-center gap-1 hover:opacity-80`}>
                  Sign in <FiArrowRight size={10} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <motion.div {...fadeUp()}
          className="max-w-3xl mx-auto text-center bg-[#0d1b2a] border border-white/10 rounded-3xl p-12">
          <h2 className="text-3xl font-extrabold mb-4">Start Using SmartCity Today</h2>
          <p className="text-gray-400 mb-8">Free access for all citizens. No credit card required.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/login?role=citizen"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3 rounded-full transition-all">
              Sign In as Citizen <FiArrowRight size={14} />
            </Link>
            <Link to="/login"
              className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-medium px-6 py-3 rounded-full transition-all">
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      <PublicFooter />
    </div>
  )
}
