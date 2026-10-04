import React, { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome, FiMap, FiTruck, FiWind, FiDroplet,
  FiMessageSquare, FiAlertOctagon,
  FiCloud, FiLogOut, FiUser, FiShield,
  FiUsers, FiBell, FiMenu, FiX,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useRBAC } from '../hooks/useRBAC';
import AlertBanner from './AlertBanner';

interface LayoutProps { children: ReactNode }

// ─── Admin sidebar (8 items as specified) ────────────────────────────────────
const ADMIN_MENU = [
  { path: '/dashboard',         name: 'Dashboard',          icon: FiHome,          key: 'dashboard'         },
  { path: '/map',               name: 'City Map',            icon: FiMap,           key: 'map'               },
  { path: '/admin-complaints',  name: 'Complaints',          icon: FiMessageSquare, key: 'admin-complaints'  },
  { path: '/admin-emergency',   name: 'Emergency',           icon: FiAlertOctagon,  key: 'admin-emergency'   },
  { path: '/admin-alerts',      name: 'Alerts',              icon: FiBell,          key: 'admin-alerts'      },
  { path: '/users',             name: 'User Management',     icon: FiUsers,         key: 'users'             },
  { path: '/roles',             name: 'Role Management',     icon: FiShield,        key: 'roles'             },
  { path: '/profile',           name: 'Profile',             icon: FiUser,          key: 'profile'           },
];

// ─── Citizen sidebar (9 items) ────────────────────────────────────────────────
const CITIZEN_MENU = [
  { path: '/dashboard',   name: 'Dashboard',       icon: FiHome,          key: 'dashboard'   },
  { path: '/map',         name: 'City Map',         icon: FiMap,           key: 'map'         },
  { path: '/air-quality', name: 'Air Quality',      icon: FiWind,          key: 'air-quality' },
  { path: '/traffic',     name: 'Traffic',          icon: FiTruck,         key: 'traffic'     },
  { path: '/weather',     name: 'Weather',          icon: FiCloud,         key: 'weather'     },
  { path: '/water-flood', name: 'Water / Flood',    icon: FiDroplet,       key: 'water-flood' },
  { path: '/complaints',  name: 'Complaints',       icon: FiMessageSquare, key: 'complaints'  },
  { path: '/emergency',   name: 'Emergency',        icon: FiAlertOctagon,  key: 'emergency'   },
  { path: '/profile',     name: 'Profile',          icon: FiUser,          key: 'profile'     },
];

// ─── Other roles: operational sidebar (shared) ────────────────────────────────
const OTHER_MENU = [
  { path: '/dashboard',          name: 'Dashboard',          icon: FiHome,          key: 'dashboard'          },
  { path: '/map',                name: 'City Map',            icon: FiMap,           key: 'map'                },
  { path: '/traffic',            name: 'Traffic',             icon: FiTruck,         key: 'traffic'            },
  { path: '/emergency',          name: 'Emergency',           icon: FiAlertOctagon,  key: 'emergency'          },
  { path: '/officer-complaints', name: 'Assigned Cases',      icon: FiMessageSquare, key: 'officer-complaints' },
  { path: '/profile',            name: 'Profile',             icon: FiUser,          key: 'profile'            },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { hasPermission, isAdmin } = useRBAC();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole = user?.roles?.[0]?.name || 'citizen';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Pick the right menu list based on role
  let menuItems = CITIZEN_MENU;
  if (isAdmin) {
    menuItems = ADMIN_MENU;
  } else if (!['citizen'].includes(userRole)) {
    menuItems = OTHER_MENU;
  }

  // Filter by permission (belt-and-suspenders — the menu defs already match)
  const visibleItems = menuItems.filter(item => hasPermission(item.key));

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    city_admin: 'City Admin',
    admin: 'Admin',
    citizen: 'Citizen',
    traffic_officer: 'Traffic Officer',
    police: 'Police',
    fire_service: 'Fire Service',
    emergency: 'Emergency',
  };

  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-base leading-tight">
              <span className="text-white">Smart</span>
              <span className="text-cyan-400">City</span>
            </p>
            <p className="text-xs text-gray-500 leading-none">
              {isAdmin ? 'City Command Center' : `${roleLabel[userRole] ?? userRole} Panel`}
            </p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={closeSidebar}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Close menu"
        >
          <FiX size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {visibleItems.map(item => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0">
            {(user?.full_name || user?.username || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.full_name || user?.username}
            </p>
            <p className="text-xs text-gray-500">{roleLabel[userRole] ?? userRole}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-sm"
        >
          <FiLogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">

      {/* ── Mobile top bar (hidden on md+) ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 glass-card shrink-0 border-b border-white/10 rounded-none">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Open menu"
        >
          <FiMenu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
            </svg>
          </div>
          <span className="font-bold text-sm">
            <span className="text-white">Smart</span>
            <span className="text-cyan-400">City</span>
          </span>
        </div>
        <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
          {(user?.full_name || user?.username || '?').charAt(0).toUpperCase()}
        </div>
      </div>

      {/* ── Sidebar: desktop (always visible), mobile (drawer) ── */}

      {/* Desktop sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="hidden md:flex w-64 glass-card flex-col p-4 shrink-0 overflow-y-auto rounded-none"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
            className="md:hidden fixed inset-0 z-30 bg-black/60"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="drawer"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="md:hidden fixed inset-y-0 left-0 z-40 w-64 glass-card flex flex-col p-4 overflow-y-auto"
          >
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <AlertBanner />
        <div className="flex-1 p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
