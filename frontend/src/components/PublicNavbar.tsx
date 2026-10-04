import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowRight, FiMenu, FiX, FiChevronRight } from 'react-icons/fi'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { label: 'Home',     path: '/'         },
  { label: 'Features', path: '/features' },
  { label: 'Services', path: '/services' },
  { label: 'Dashboard',path: '/app'      },
  { label: 'About Us', path: '/about'    },
  { label: 'Contact',  path: '/contact'  },
]

const ROLES = [
  { label: 'Citizen',           role: 'citizen',         color: 'text-blue-400'   },
  { label: 'City Admin',        role: 'admin',           color: 'text-purple-400' },
  { label: 'Traffic Officer',   role: 'traffic_officer', color: 'text-orange-400' },
  { label: 'Police',            role: 'police',          color: 'text-red-400'    },
  { label: 'Fire Service',      role: 'fire_service',    color: 'text-yellow-400' },
  { label: 'Emergency',         role: 'emergency',       color: 'text-green-400'  },
]

interface Props { active?: string }

export default function PublicNavbar({ active }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [roleModal, setRoleModal] = useState(false)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleDashboard = () => {
    if (isAuthenticated) navigate('/dashboard')
    else setRoleModal(true)
  }

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled ? 'backdrop-blur-xl bg-[#070f1a]/90 border-b border-white/8 shadow-2xl' : 'backdrop-blur-md bg-[#070f1a]/60'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-green-400 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="white" strokeWidth={2}>
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg text-white">SmartCity</span>
              <p className="text-[10px] text-gray-400 leading-none">Better City, Better Life</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(({ label, path }) => {
              const isActive = active === label
              if (label === 'Dashboard') return (
                <button key={label} onClick={handleDashboard}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'text-green-400 bg-green-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                  {label}
                </button>
              )
              return (
                <Link key={label} to={path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'text-green-400 bg-green-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-5 py-2 rounded-full transition-all">
                Dashboard <FiArrowRight size={13} />
              </button>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block text-sm font-medium text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-all">
                  Sign In
                </Link>
                <button onClick={() => setRoleModal(true)}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold text-sm px-5 py-2 rounded-full transition-all">
                  Get Started <FiArrowRight size={13} />
                </button>
              </>
            )}
            {/* Mobile toggle */}
            <button onClick={() => setMobileOpen(o => !o)}
              className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-white/8 bg-[#070f1a]/98">
              <div className="px-6 py-4 space-y-1">
                {NAV_ITEMS.map(({ label, path }) => {
                  const isActive = active === label
                  if (label === 'Dashboard') return (
                    <button key={label} onClick={() => { setMobileOpen(false); handleDashboard() }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between
                        ${isActive ? 'text-green-400 bg-green-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                      {label} <FiChevronRight size={14} />
                    </button>
                  )
                  return (
                    <Link key={label} to={path} onClick={() => setMobileOpen(false)}
                      className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between
                        ${isActive ? 'text-green-400 bg-green-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}>
                      {label} <FiChevronRight size={14} />
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Role modal */}
      <AnimatePresence>
        {roleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setRoleModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
              className="bg-[#0d1b2a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-white mb-1">Select Your Role</h2>
              <p className="text-gray-400 text-sm mb-6">Choose your role to access the dashboard</p>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(({ label, role, color }) => (
                  <Link key={role} to={`/login?role=${role}`}
                    className={`flex items-center justify-between border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 transition-all hover:bg-white/5`}>
                    <span className={`font-semibold text-sm ${color}`}>{label}</span>
                    <FiChevronRight size={13} className="text-gray-500" />
                  </Link>
                ))}
              </div>
              <button onClick={() => setRoleModal(false)}
                className="mt-5 text-gray-500 hover:text-gray-300 text-sm transition-colors w-full text-center">
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
