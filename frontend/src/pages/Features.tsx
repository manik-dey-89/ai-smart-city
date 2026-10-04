import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiTruck, FiWind, FiCloud, FiDroplet, FiTrash2, FiMessageSquare,
  FiAlertOctagon, FiMap, FiZap, FiShield, FiActivity, FiCpu,
  FiArrowRight, FiCheck, FiChevronDown, FiChevronUp,
  FiBarChart2, FiNavigation, FiUsers, FiLock, FiSun,
} from 'react-icons/fi'
import PublicNavbar from '../components/PublicNavbar'
import PublicFooter from '../components/PublicFooter'

/* ── Types ──────────────────────────────────────────────────── */
interface Feature {
  id: string
  icon: React.ElementType
  color: string
  bg: string
  title: string
  tagline: string
  description: string
  bullets: string[]
  img: string
  badge?: string
  externalLink?: string
}

/* ── Data ───────────────────────────────────────────────────── */
const FEATURES: Feature[] = [
  {
    id: 'traffic',
    icon: FiTruck, color: 'text-orange-400', bg: 'bg-orange-500/10',
    title: 'AI Traffic Intelligence',
    tagline: 'Real-time congestion analysis & smart routing',
    description: 'TrafficSense AI analyses live road conditions using historical patterns and real-time data from OpenStreetMap and OSRM to predict congestion, suggest alternate routes and estimate travel time.',
    bullets: [
      'Live congestion index (0–100) per city',
      'OSRM-powered real route calculation',
      'Weather-adjusted traffic predictions',
      'Incident detection & delay estimation',
      '24-hour temporal flow forecasting',
      'AI voice route summary',
    ],
    img: '/illustrations/01_traffic_illustration.png',
    badge: 'AI Powered',
  },
  {
    id: 'air',
    icon: FiWind, color: 'text-green-400', bg: 'bg-green-500/10',
    title: 'Air Quality Monitoring',
    tagline: 'Live AQI with health advisories',
    description: 'Real-time air quality data powered by Open-Meteo AQ API covering PM2.5, PM10, NO₂, O₃, CO and SO₂ with US EPA AQI calculation and personalised health recommendations.',
    bullets: [
      'Live US AQI from PM2.5 (EPA formula)',
      'Six pollutant readings in real-time',
      'Category-based health advisories',
      'Visual pollutant level bars',
      'City-wide coverage via Open-Meteo',
      'Historical trend comparison',
    ],
    img: '/illustrations/03_air_quality_aqi_illustration.png',
    badge: 'Live Data',
  },
  {
    id: 'weather',
    icon: FiCloud, color: 'text-blue-400', bg: 'bg-blue-500/10',
    title: 'Weather Intelligence',
    tagline: '7-day forecast with hyperlocal accuracy',
    description: 'Comprehensive weather data from Open-Meteo covering current conditions, 7-day forecasts, hourly breakdowns and severe weather alerts — all without a paid API key.',
    bullets: [
      'Current temperature, humidity, wind',
      'WMO weather-code condition mapping',
      '7-day daily forecast grid',
      'Precipitation and wind forecasting',
      'Feels-like and UV index',
      'Weather impact on traffic & AQI',
    ],
    img: '/illustrations/01_background_city_scene.png',
  },
  {
    id: 'water',
    icon: FiDroplet, color: 'text-cyan-400', bg: 'bg-cyan-500/10',
    title: 'Water & Flood Monitoring',
    tagline: 'Flood risk assessment and water level alerts',
    description: 'Monitor river, reservoir and drainage water levels across the city. Get flood risk assessments based on current conditions and proactive early-warning alerts.',
    bullets: [
      'Real-time water level indicators',
      'Flood risk zone mapping',
      'Drainage and sewage status',
      'Historical flood data analysis',
      'Early-warning notification system',
      'Integration with city emergency services',
    ],
    img: '/illustrations/02_water_level_illustration.png',
  },
  {
    id: 'waste',
    icon: FiTrash2, color: 'text-purple-400', bg: 'bg-purple-500/10',
    title: 'Smart Waste Management',
    tagline: 'IoT-connected bins and collection scheduling',
    description: 'Track garbage collection routes, monitor smart bin fill levels and optimise waste management operations across all city zones using IoT sensor integration.',
    bullets: [
      'Smart bin fill-level monitoring',
      'Collection schedule management',
      'Route optimisation for trucks',
      'Zone-based waste analytics',
      'Citizen complaint routing to waste dept',
      'Monthly waste volume reporting',
    ],
    img: '/illustrations/04_garbage_truck_illustration.png',
  },
  {
    id: 'complaints',
    icon: FiMessageSquare, color: 'text-yellow-400', bg: 'bg-yellow-500/10',
    title: 'Universal Complaint System',
    tagline: 'End-to-end complaint tracking with case ID',
    description: 'Citizens report any civic or emergency issue — from potholes to criminal cases — with map-based location picking, evidence upload, automatic department routing, and real-time case tracking.',
    bullets: [
      '15+ complaint categories',
      'Interactive OSM map location picker',
      'GPS auto-location support',
      'Evidence photo/document upload',
      'Auto-generated CMP tracking ID',
      'Admin approve/reject/route workflow',
      'Officer case management panel',
      'Full audit history timeline',
    ],
    img: '/illustrations/05_municipality_illustration.png',
    badge: 'New',
  },
  {
    id: 'emergency',
    icon: FiAlertOctagon, color: 'text-red-400', bg: 'bg-red-500/10',
    title: 'Emergency Response',
    tagline: 'Rapid emergency request & coordination',
    description: 'Citizens submit emergency requests that instantly reach police, fire service and medical teams. Coordinated response tracking with live status updates and location sharing.',
    bullets: [
      'One-tap emergency request submission',
      'Multi-agency dispatch coordination',
      'Live response status tracking',
      'Incident severity classification',
      'Emergency contact directory',
      'Integration with 112 helpline',
    ],
    img: '/illustrations/06_emergency_alert_illustration.png',
  },
  {
    id: 'map',
    icon: FiMap, color: 'text-indigo-400', bg: 'bg-indigo-500/10',
    title: 'Interactive City Map',
    tagline: 'Live city-wide situational awareness',
    description: 'A unified geospatial view of all city assets — emergency stations, sensors, incidents, smart bins, traffic hotspots and flood zones — powered entirely by OpenStreetMap (100% free).',
    bullets: [
      'OpenStreetMap + Leaflet rendering',
      'Real-time incident markers',
      'Emergency station locations',
      'Smart bin and sensor overlays',
      'Flood zone polygon layers',
      'Click-through asset details',
    ],
    img: '/illustrations/01_background_city_scene.png',
  },
  {
    id: 'agrihub',
    icon: FiSun, color: 'text-green-400', bg: 'bg-green-500/10',
    title: 'AgriHub — Smart Farming Portal',
    tagline: 'Crop management, mandi prices & farmer advisory',
    description: 'A dedicated agricultural intelligence platform for farmers — featuring AI-powered crop recommendations, live mandi market prices, government scheme access, a produce marketplace for buying & selling, and expert Q&A advisory. Fully integrated as a separate smart farming portal.',
    bullets: [
      'AI crop recommender (soil type + season + rainfall)',
      'Live mandi prices for 15+ Indian markets',
      'Crop management with growth stage tracking',
      'Farmer-to-buyer produce marketplace',
      '6 real government schemes (PM-KISAN, PMFBY, KCC…)',
      'Expert Q&A community for farming problems',
      'Free for all farmers — no paid API required',
    ],
    img: '/illustrations/01_background_city_scene.png',
    badge: 'External Portal',
    externalLink: 'https://agrihub-portal.onrender.com/',
  },
]

const TECH_STACK = [
  { name: 'React 18 + TypeScript',  desc: 'Type-safe SPA with hooks and context', icon: FiCpu,      color: 'text-blue-400'   },
  { name: 'FastAPI + Python',       desc: 'High-performance async backend API',   icon: FiZap,      color: 'text-yellow-400' },
  { name: 'SQLite / SQLAlchemy',    desc: 'Relational DB with full audit trails', icon: FiBarChart2,color: 'text-green-400'  },
  { name: 'OpenStreetMap + OSRM',   desc: 'Free routing and mapping — no API key', icon: FiNavigation,color:'text-cyan-400'  },
  { name: 'Open-Meteo APIs',        desc: 'Weather and air quality — free tier', icon: FiCloud,    color: 'text-indigo-400' },
  { name: 'JWT + Role-Based Auth',  desc: 'Secure access control across all panels', icon: FiLock,  color: 'text-purple-400' },
  { name: 'Framer Motion',          desc: 'Premium micro-animations throughout',  icon: FiActivity, color: 'text-pink-400'   },
  { name: 'Leaflet + React-Leaflet',desc: 'Interactive maps with custom overlays',icon: FiMap,     color: 'text-orange-400' },
]

const STATS = [
  { val: '8+',    label: 'Smart Modules',      icon: FiCpu,      color: 'text-cyan-400'   },
  { val: '15+',   label: 'Complaint Types',    icon: FiMessageSquare, color: 'text-yellow-400'},
  { val: '100%',  label: 'Free-tier APIs',     icon: FiShield,   color: 'text-green-400'  },
  { val: '6',     label: 'Role-based Panels',  icon: FiUsers,    color: 'text-purple-400' },
]

/* ── FAQ ─────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'Is any paid API key required?', a: 'No. Every data source (OpenStreetMap, OSRM, Open-Meteo) is completely free with no key needed. The project is 100% open-source API based.' },
  { q: 'How does the complaint routing work?', a: 'When an admin approves a complaint, the system automatically detects the complaint type using a keyword-matching routing engine and assigns it to the correct officer panel — Police, Traffic, Fire, or Municipal.' },
  { q: 'Can citizens track their case?', a: 'Yes. Every complaint gets a unique CMP-YYYY-XXXXXX tracking ID. Citizens can enter this ID in the Case Tracking tab to see the full status pipeline and activity history in real-time.' },
  { q: 'What roles are supported?', a: 'Six roles: Citizen, City Admin, Traffic Officer, Police, Fire Service, and Emergency Responder — each with a dedicated panel and role-based permissions enforced on both frontend and backend.' },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
})

/* ══ Component ══════════════════════════════════════════════════ */
export default function Features() {
  const [activeFeature, setActiveFeature] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-[#070f1a] text-white overflow-x-hidden">
      <PublicNavbar active="Features" />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>
        <motion.div {...fadeUp()} className="max-w-3xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold mb-6">
            <FiCpu size={13} /> Platform Features
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
            Everything a Smart City Needs,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">
              Built Right In
            </span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Eight integrated modules — from AI traffic routing to universal complaint management — all running on free APIs, production-grade architecture, and role-based security.
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div {...fadeUp(0.2)} className="mt-14 max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(({ val, label, icon: Icon, color }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <Icon size={20} className={`${color} mb-2`} />
              <p className={`text-3xl font-extrabold ${color}`}>{val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Feature cards ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-20 space-y-6">
        {FEATURES.map((f, i) => {
          const Icon = f.icon
          const isOpen = activeFeature === f.id
          const isEven = i % 2 === 0
          return (
            <motion.div key={f.id} {...fadeUp(0.05 * i)}
              className={`border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer
                ${isOpen ? 'border-white/20 bg-white/5' : 'border-white/10 bg-[#0d1b2a]/60 hover:border-white/15'}`}
              onClick={() => setActiveFeature(isOpen ? null : f.id)}>

              {/* Header row */}
              <div className="flex items-center justify-between p-6 gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`p-3 rounded-xl shrink-0 ${f.bg}`}>
                    <Icon size={22} className={f.color} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white">{f.title}</h3>
                      {f.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.bg} ${f.color}`}>
                          {f.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 truncate">{f.tagline}</p>
                  </div>
                </div>
                <div className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  <FiChevronDown size={18} className="text-gray-400" />
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                    className="overflow-hidden">
                    <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 px-6 pb-8`}>
                      {/* Text */}
                      <div className="flex-1">
                        <p className="text-gray-300 leading-relaxed mb-5">{f.description}</p>
                        <ul className="space-y-2">
                          {f.bullets.map(b => (
                            <li key={b} className="flex items-start gap-2.5 text-sm text-gray-300">
                              <FiCheck size={14} className={`${f.color} mt-0.5 shrink-0`} />
                              {b}
                            </li>
                          ))}
                        </ul>
                        {f.externalLink ? (
                            <a href={f.externalLink} target="_blank" rel="noopener noreferrer"
                              className={`inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold
                                          transition-all ${f.bg} ${f.color} border border-white/10 hover:border-white/20`}>
                              Get Started <FiArrowRight size={13} />
                            </a>
                          ) : (
                            <Link to="/login"
                              className={`inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold
                                          transition-all ${f.bg} ${f.color} border border-white/10 hover:border-white/20`}>
                              Try {f.title.split(' ')[0]} <FiArrowRight size={13} />
                            </Link>
                          )}
                      </div>
                      {/* Illustration */}
                      <div className="shrink-0 flex items-center justify-center lg:w-48">
                        <img src={f.img} alt={f.title}
                          className="w-36 h-36 object-contain opacity-85 drop-shadow-2xl" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </section>

      {/* ── Tech stack ─────────────────────────────────────── */}
      <section className="bg-white/3 border-y border-white/8 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold mb-3">Technology Stack</h2>
            <p className="text-gray-400">Production-grade tools — all free and open-source</p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TECH_STACK.map(({ name, desc, icon: Icon, color }, i) => (
              <motion.div key={name} {...fadeUp(0.04 * i)}
                className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group">
                <Icon size={22} className={`${color} mb-3`} />
                <p className="text-sm font-bold text-white mb-1">{name}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <motion.div {...fadeUp()} className="text-center mb-10">
          <h2 className="text-3xl font-extrabold mb-3">Frequently Asked</h2>
          <p className="text-gray-400">Common questions about the SmartCity platform</p>
        </motion.div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <motion.div key={i} {...fadeUp(0.04 * i)}
              className="border border-white/10 rounded-2xl overflow-hidden bg-[#0d1b2a]/60">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/3 transition-all">
                <span className="font-semibold text-white text-sm">{faq.q}</span>
                {openFaq === i ? <FiChevronUp size={16} className="text-cyan-400 shrink-0" />
                  : <FiChevronDown size={16} className="text-gray-500 shrink-0" />}
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <motion.div {...fadeUp()}
          className="max-w-4xl mx-auto text-center bg-gradient-to-r from-[#0d1b2a] via-[#0e2235] to-[#0d1b2a]
                     border border-white/10 rounded-3xl p-14">
          <h2 className="text-3xl font-extrabold mb-4">
            Ready to experience the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">
              Smart City?
            </span>
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Sign in with your role to access live dashboards, real-time data and all city services.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3.5 rounded-full text-base transition-all shadow-lg shadow-green-500/20">
            Get Started <FiArrowRight size={16} />
          </Link>
        </motion.div>
      </section>

      <PublicFooter />
    </div>
  )
}
