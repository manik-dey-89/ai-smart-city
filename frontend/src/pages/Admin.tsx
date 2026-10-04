import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiMessageSquare, FiBell, FiAlertOctagon,
  FiFileText, FiRefreshCw, FiArrowRight, FiLoader,
  FiAlertCircle, FiCheckCircle, FiActivity,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RecentItem {
  id: string;
  type?: string;
  title: string;
  priority?: string;
  severity?: string;
  status: string;
  created_at: string;
  reporter?: string;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  total_complaints: number;
  pending_complaints: number;
  active_alerts: number;
  active_emergencies: number;
  total_incidents: number;
  recent_complaints: RecentItem[];
  recent_incidents: RecentItem[];
  recent_alerts: RecentItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    active: 'bg-yellow-500/15 text-yellow-400',
    submitted: 'bg-yellow-500/15 text-yellow-400',
    under_review: 'bg-blue-500/15 text-blue-400',
    assigned: 'bg-purple-500/15 text-purple-400',
    in_progress: 'bg-cyan-500/15 text-cyan-400',
    resolved: 'bg-green-500/15 text-green-400',
    rejected: 'bg-red-500/15 text-red-400',
    cancelled: 'bg-gray-500/15 text-gray-400',
    inactive: 'bg-gray-500/15 text-gray-400',
  };
  return m[s?.toLowerCase()] ?? 'bg-gray-500/15 text-gray-400';
}

function severityColor(s: string) {
  const m: Record<string, string> = {
    low: 'text-green-400', medium: 'text-yellow-400',
    high: 'text-orange-400', critical: 'text-red-400',
  };
  return m[s?.toLowerCase()] ?? 'text-gray-400';
}

// ─── Summary card ─────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  title: string; value: number | string; sub?: string;
  icon: React.ElementType; color: string; bg: string;
  to?: string; delay?: number;
}> = ({ title, value, sub, icon: Icon, color, bg, to, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-5 flex flex-col gap-3 group hover:border-white/20 transition-all"
  >
    <div className="flex items-start justify-between">
      <div className={`p-2.5 rounded-xl ${bg}`}>
        <Icon size={20} className={color} />
      </div>
      {to && (
        <Link to={to}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-cyan-400 flex items-center gap-1">
          View <FiArrowRight size={11} />
        </Link>
      )}
    </div>
    <div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
    <p className="text-sm text-gray-400 font-medium">{title}</p>
  </motion.div>
);

// ─── Recent list ─────────────────────────────────────────────────────────────
const RecentList: React.FC<{
  title: string; icon: React.ElementType; iconColor: string;
  items: RecentItem[]; to: string; toLabel: string;
  renderSub: (item: RecentItem) => React.ReactNode;
}> = ({ title, icon: Icon, iconColor, items, to, toLabel, renderSub }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
    className="glass-card p-5"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={iconColor} />
        <h2 className="font-semibold text-white text-sm">{title}</h2>
      </div>
      <Link to={to} className="text-xs text-cyan-400 hover:opacity-80 flex items-center gap-1">
        {toLabel} <FiArrowRight size={11} />
      </Link>
    </div>

    {items.length === 0 ? (
      <p className="text-sm text-gray-600 text-center py-4">No recent items</p>
    ) : (
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-start justify-between gap-2 pb-3 border-b border-white/5 last:border-0 last:pb-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {renderSub(item)}
                <span className="text-xs text-gray-600">{fmtDate(item.created_at)}</span>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor(item.status)}`}>
              {item.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    )}
  </motion.div>
);

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
const Admin: React.FC = () => {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/stats');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail || 'Failed to load dashboard stats');
        return;
      }
      setStats(await res.json());
    } catch {
      setError('Network error — could not load stats');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">City Command Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">Admin Dashboard — real-time city overview</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 transition-all disabled:opacity-50"
        >
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && !stats && (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <FiLoader size={24} className="animate-spin text-cyan-400" />
          <span>Loading admin stats…</span>
        </div>
      )}

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
          >
            <FiAlertCircle size={15} className="shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {stats && (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users" value={stats.total_users}
              sub={`${stats.active_users} active`}
              icon={FiUsers} color="text-cyan-400" bg="bg-cyan-500/10"
              to="/users" delay={0}
            />
            <StatCard
              title="Complaints" value={stats.total_complaints}
              sub={`${stats.pending_complaints} pending`}
              icon={FiMessageSquare} color="text-yellow-400" bg="bg-yellow-500/10"
              to="/admin-complaints" delay={0.05}
            />
            <StatCard
              title="Active Alerts" value={stats.active_alerts}
              icon={FiBell} color="text-orange-400" bg="bg-orange-500/10"
              to="/admin-alerts" delay={0.1}
            />
            <StatCard
              title="Active Emergencies" value={stats.active_emergencies}
              icon={FiAlertOctagon} color="text-red-400" bg="bg-red-500/10"
              to="/admin-emergency" delay={0.15}
            />
          </div>

          {/* Secondary stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Incidents Logged',
                value: stats.total_incidents,
                color: 'text-purple-400',
                icon: FiFileText,
              },
              {
                label: 'Resolved Complaints',
                value: stats.total_complaints - stats.pending_complaints,
                color: 'text-green-400',
                icon: FiCheckCircle,
              },
              {
                label: 'System Status',
                value: 'Online',
                color: 'text-green-400',
                icon: FiActivity,
              },
            ].map(({ label, value, color, icon: Ic }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="glass-card px-5 py-4 flex items-center gap-4"
              >
                <Ic size={20} className={color} />
                <div>
                  <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Recent activity (3 columns) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            <RecentList
              title="Recent Complaints"
              icon={FiMessageSquare} iconColor="text-yellow-400"
              items={stats.recent_complaints}
              to="/admin-complaints" toLabel="All complaints"
              renderSub={item => (
                <>
                  {item.type && <span className="text-xs text-gray-500">{item.type}</span>}
                  {item.priority && (
                    <span className={`text-xs font-semibold capitalize ${severityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  )}
                  {item.reporter && <span className="text-xs text-gray-600">by {item.reporter}</span>}
                </>
              )}
            />

            <RecentList
              title="Recent Incidents"
              icon={FiFileText} iconColor="text-purple-400"
              items={stats.recent_incidents}
              to="/admin-emergency" toLabel="All incidents"
              renderSub={item => (
                <>
                  {item.type && <span className="text-xs text-gray-500">{item.type}</span>}
                  {item.severity && (
                    <span className={`text-xs font-semibold capitalize ${severityColor(item.severity)}`}>
                      {item.severity}
                    </span>
                  )}
                </>
              )}
            />

            <RecentList
              title="Recent Alerts"
              icon={FiBell} iconColor="text-orange-400"
              items={stats.recent_alerts}
              to="/admin-alerts" toLabel="All alerts"
              renderSub={item => (
                <>
                  {item.type && <span className="text-xs text-gray-500">{item.type}</span>}
                  {item.severity && (
                    <span className={`text-xs font-semibold capitalize ${severityColor(item.severity)}`}>
                      {item.severity}
                    </span>
                  )}
                </>
              )}
            />

          </div>

          {/* ── Quick actions ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-card p-5"
          >
            <h2 className="font-semibold text-white mb-4 text-sm">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { to: '/admin-complaints', label: 'Manage Complaints',  icon: FiMessageSquare, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                { to: '/admin-emergency',  label: 'View Emergencies',   icon: FiAlertOctagon,  color: 'text-red-400',    bg: 'bg-red-500/10'    },
                { to: '/admin-alerts',     label: 'Create Alert',       icon: FiBell,          color: 'text-orange-400', bg: 'bg-orange-500/10' },
                { to: '/users',            label: 'Manage Users',       icon: FiUsers,         color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
              ].map(({ to, label, icon: Ic, color, bg }) => (
                <Link
                  key={to} to={to}
                  className={`flex items-center gap-3 p-3 rounded-xl ${bg} border border-white/5
                              hover:border-white/15 transition-all group`}
                >
                  <Ic size={16} className={color} />
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default Admin;
