import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FiTarget, FiEye, FiHeart, FiZap, FiShield, FiGlobe,
  FiArrowRight, FiCode, FiDatabase, FiServer, FiLayers,
  FiUsers, FiAward, FiBookOpen,
} from 'react-icons/fi'
import PublicNavbar from '../components/PublicNavbar'
import PublicFooter from '../components/PublicFooter'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, delay },
})

const OBJECTIVES = [
  { icon: FiGlobe,    color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   title: 'Real-Time Awareness',   desc: 'Provide citizens and administrators with live, accurate data on traffic, air quality, weather and water conditions.' },
  { icon: FiShield,   color: 'text-green-400',  bg: 'bg-green-500/10',  title: 'Public Safety First',   desc: 'Accelerate emergency response times, route complaints to the right department and track every case end-to-end.' },
  { icon: FiHeart,    color: 'text-pink-400',   bg: 'bg-pink-500/10',   title: 'Citizen Empowerment',   desc: 'Give every citizen a voice — report issues, track progress and hold civic authorities accountable transparently.' },
  { icon: FiZap,      color: 'text-yellow-400', bg: 'bg-yellow-500/10', title: 'Operational Efficiency', desc: 'Reduce administrative overhead with smart routing, automated workflows and data-driven resource allocation.' },
  { icon: FiBookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10', title: 'Open & Accessible',     desc: 'Built entirely on free, open-source APIs and tools — no vendor lock-in, no hidden costs, no barriers to adoption.' },
  { icon: FiAward,    color: 'text-orange-400', bg: 'bg-orange-500/10', title: 'Sustainable Growth',    desc: 'Scalable architecture designed to grow from one district to an entire metropolitan area without re-engineering.' },
]

const TEAM = [
  { name: 'SmartCity Core Team',     role: 'Full-Stack Architecture',    avatar: '🏗', skills: ['FastAPI', 'React', 'SQLAlchemy', 'TypeScript'] },
  { name: 'AI & Data Science Lead',  role: 'Traffic & Prediction Models', avatar: '🤖', skills: ['OSRM', 'Open-Meteo', 'Congestion Modelling', 'ML Pipeline'] },
  { name: 'Civic Tech Division',     role: 'Complaint & Case Systems',   avatar: '⚖',  skills: ['Routing Engine', 'RBAC', 'Audit Trails', 'Officer Panels'] },
  { name: 'GIS & Maps Unit',         role: 'Geospatial Intelligence',    avatar: '🗺',  skills: ['OpenStreetMap', 'Leaflet', 'Overpass API', 'GeoJSON'] },
]

const MILESTONES = [
  { year: '2024 Q1', title: 'Project Inception',       desc: 'SmartCity Dashboard conceived to address fragmented civic infrastructure management.' },
  { year: '2024 Q2', title: 'Core Platform Built',     desc: 'Authentication, role-based panels, weather/AQI integration and city map launched.' },
  { year: '2024 Q3', title: 'Traffic AI & Complaints', desc: 'TrafficSense AI with OSRM routing and the universal complaint system deployed.' },
  { year: '2025 Q1', title: 'Officer Routing System',  desc: 'End-to-end complaint lifecycle: citizen → admin approve → officer panel → resolution.' },
  { year: '2025 Q2', title: 'Production Hardening',    desc: 'Security audit, rate limiting, audit trails, evidence upload and voice assistant added.' },
  { year: 'Ongoing', title: 'Expanding City Coverage', desc: 'Scaling to additional cities with configurable routing, IoT integration and mobile apps.' },
]

const TECH_PILLARS = [
  { icon: FiCode,     color: 'text-blue-400',   title: 'Frontend',   items: ['React 18 + TypeScript', 'Tailwind CSS + Framer Motion', 'Leaflet + React-Leaflet', 'Chart.js for analytics'] },
  { icon: FiServer,   color: 'text-green-400',  title: 'Backend',    items: ['FastAPI (Python 3.10+)', 'SQLAlchemy ORM', 'JWT authentication', 'Pydantic validation'] },
  { icon: FiDatabase, color: 'text-yellow-400', title: 'Data',       items: ['SQLite (dev) / PostgreSQL', 'Open-Meteo Weather & AQI', 'OSRM Routing Engine', 'Nominatim Geocoding'] },
  { icon: FiLayers,   color: 'text-purple-400', title: 'Design',     items: ['Glassmorphism dark theme', 'Mobile-first responsive', 'WCAG-aware contrast', 'Micro-animation system'] },
]

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-[#070f1a] text-white overflow-x-hidden">
      <PublicNavbar active="About Us" />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-1/4 w-[500px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div {...fadeUp()} className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold mb-6">
              <FiHeart size={13} /> About SmartCity
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-6">
              Building Cities That{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                Work for People
              </span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">
              SmartCity is an open-source, production-ready urban intelligence platform that connects citizens, civic officers and city administrators through real-time data, intelligent automation and transparent governance.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Mission & Vision ──────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div {...fadeUp(0.05)}
            className="bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-cyan-500/15">
                <FiTarget size={20} className="text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Our Mission</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              To democratise access to smart city infrastructure by building a fully open-source, role-based urban dashboard that gives every citizen, officer and administrator real-time situational awareness — free of charge, free of vendor lock-in.
            </p>
            <div className="mt-5 space-y-2">
              {['Transparent governance', 'Real-time civic data', 'Zero vendor lock-in'].map(m => (
                <div key={m} className="flex items-center gap-2 text-sm text-cyan-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {m}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.1)}
            className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-purple-500/15">
                <FiEye size={20} className="text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Our Vision</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              A world where every city — regardless of budget or technical maturity — can deploy intelligent infrastructure management in days, not years. Where data flows freely between citizens and government, building trust and driving faster, smarter decisions.
            </p>
            <div className="mt-5 space-y-2">
              {['AI-augmented city ops', 'Citizen-first design', 'Scalable to any city'].map(m => (
                <div key={m} className="flex items-center gap-2 text-sm text-purple-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  {m}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Objectives ────────────────────────────────────── */}
      <section className="bg-white/3 border-y border-white/8 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold mb-3">Core Objectives</h2>
            <p className="text-gray-400">The six principles that guide every design and engineering decision</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {OBJECTIVES.map(({ icon: Icon, color, bg, title, desc }, i) => (
              <motion.div key={title} {...fadeUp(0.05 * i)}
                className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                <div className={`p-3 rounded-xl ${bg} w-fit mb-4`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technology pillars ────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <motion.div {...fadeUp()} className="text-center mb-12">
          <h2 className="text-3xl font-extrabold mb-3">Technology Foundation</h2>
          <p className="text-gray-400">Production-grade stack built entirely on open-source tools</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TECH_PILLARS.map(({ icon: Icon, color, title, items }, i) => (
            <motion.div key={title} {...fadeUp(0.05 * i)}
              className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <Icon size={20} className={color} />
                <h3 className="font-bold text-white">{title}</h3>
              </div>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Timeline ──────────────────────────────────────── */}
      <section className="bg-white/3 border-y border-white/8 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp()} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold mb-3">Project Timeline</h2>
            <p className="text-gray-400">From concept to production — the SmartCity journey</p>
          </motion.div>
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10 hidden sm:block" />
            <div className="space-y-8">
              {MILESTONES.map(({ year, title, desc }, i) => (
                <motion.div key={title} {...fadeUp(0.06 * i)}
                  className="flex gap-6 items-start">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center z-10">
                    <span className="text-[10px] font-bold text-cyan-400 text-center leading-tight px-1">{year}</span>
                  </div>
                  <div className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-5 flex-1 hover:border-white/20 transition-all">
                    <h3 className="font-bold text-white mb-1">{title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <motion.div {...fadeUp()} className="text-center mb-12">
          <h2 className="text-3xl font-extrabold mb-3">The Team</h2>
          <p className="text-gray-400">Multidisciplinary engineers and civic technologists</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TEAM.map(({ name, role, avatar, skills }, i) => (
            <motion.div key={name} {...fadeUp(0.05 * i)}
              className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6 text-center hover:border-white/20 transition-all">
              <div className="text-4xl mb-4">{avatar}</div>
              <h3 className="font-bold text-white mb-1">{name}</h3>
              <p className="text-xs text-gray-500 mb-4">{role}</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {skills.map(s => (
                  <span key={s} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-[#0d1b2a] via-[#0e2235] to-[#0d1b2a] border-y border-white/8 py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { val: '8+',    label: 'Smart Modules',      icon: FiLayers,   color: 'text-cyan-400'   },
            { val: '6',     label: 'Role Panels',         icon: FiUsers,    color: 'text-purple-400' },
            { val: '100%',  label: 'Open-Source APIs',   icon: FiCode,     color: 'text-green-400'  },
            { val: '∞',     label: 'Scalability',        icon: FiZap,      color: 'text-yellow-400' },
          ].map(({ val, label, icon: Icon, color }) => (
            <motion.div key={label} {...fadeUp(0.05)}>
              <Icon size={22} className={`${color} mx-auto mb-2`} />
              <p className={`text-3xl font-extrabold ${color}`}>{val}</p>
              <p className="text-sm text-gray-400 mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <motion.div {...fadeUp()}
          className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4">Join the SmartCity Movement</h2>
          <p className="text-gray-400 mb-8">
            Whether you're a citizen, civic officer or city administrator — your city is smarter with you in it.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/login"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3 rounded-full transition-all">
              Sign In <FiArrowRight size={14} />
            </Link>
            <Link to="/contact"
              className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-medium px-6 py-3 rounded-full transition-all">
              Contact Us
            </Link>
          </div>
        </motion.div>
      </section>

      <PublicFooter />
    </div>
  )
}
