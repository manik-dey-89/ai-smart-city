import { Link } from 'react-router-dom'
import { FiGithub, FiMail, FiMapPin, FiArrowRight } from 'react-icons/fi'

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#040c14]">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Brand */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-green-400 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="white" strokeWidth={2}>
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
              </svg>
            </div>
            <span className="font-bold text-white">SmartCity</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            Open-source urban intelligence platform connecting citizens, officers and administrators in real-time.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FiMapPin size={11} /> Built for Indian Smart Cities
          </div>
        </div>

        {/* Platform */}
        <div>
          <h4 className="font-semibold text-white text-sm mb-4">Platform</h4>
          <ul className="space-y-2.5">
            {[
              { label: 'Features', to: '/features' },
              { label: 'Services', to: '/services' },
              { label: 'Dashboard', to: '/login' },
              { label: 'Complaint Centre', to: '/login' },
              { label: 'Emergency', to: '/login' },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 group">
                  <FiArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-semibold text-white text-sm mb-4">Company</h4>
          <ul className="space-y-2.5">
            {[
              { label: 'About Us', to: '/about' },
              { label: 'Contact', to: '/contact' },
              { label: 'Sign In', to: '/login' },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 group">
                  <FiArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact mini */}
        <div>
          <h4 className="font-semibold text-white text-sm mb-4">Get in Touch</h4>
          <div className="space-y-3">
            <a href="mailto:contact@smartcity.gov"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <FiMail size={13} className="text-cyan-400" /> contact@smartcity.gov
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <FiGithub size={13} className="text-gray-400" /> github.com/smartcity
            </a>
          </div>
          <Link to="/contact"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl text-xs text-gray-300 hover:text-white transition-all">
            Send us a message <FiArrowRight size={11} />
          </Link>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} SmartCity Dashboard. All rights reserved.</p>
        <p className="text-xs text-gray-700">Built with React · FastAPI · OpenStreetMap · Open-Meteo</p>
      </div>
    </footer>
  )
}
