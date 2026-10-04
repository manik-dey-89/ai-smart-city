/**
 * AlertBanner.tsx
 * Polls /api/citizen/alerts every 60 s and renders a dismissible
 * scrolling ticker for every active city-wide alert.
 * Shown globally in Layout so ALL roles see admin-created alerts.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiX, FiChevronLeft, FiChevronRight,
  FiZap, FiCloud, FiAlertOctagon, FiDroplet, FiWind, FiRadio,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface CityAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  area_lat?: number | null;
  area_lng?: number | null;
  created_at: string;
}

/* ── Metadata maps ──────────────────────────────────────────────────────────── */
const TYPE_ICON: Record<string, React.ElementType> = {
  TRAFFIC:     FiZap,
  WEATHER:     FiCloud,
  EMERGENCY:   FiAlertOctagon,
  FLOOD:       FiDroplet,
  AIR_QUALITY: FiWind,
  GENERAL:     FiRadio,
};

const SEV_STYLE: Record<string, { bar: string; badge: string; text: string; bg: string; border: string }> = {
  critical: { bar: 'bg-red-500',    badge: 'bg-red-500/20 text-red-300 border-red-500/40',    text: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    },
  high:     { bar: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  medium:   { bar: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', text: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  low:      { bar: 'bg-green-500',  badge: 'bg-green-500/20 text-green-300 border-green-500/40',    text: 'text-green-300',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
};

function sevStyle(s: string) { return SEV_STYLE[s?.toLowerCase()] ?? SEV_STYLE.medium; }
function typeIcon(t: string): React.ElementType { return TYPE_ICON[t?.toUpperCase()] ?? FiRadio; }

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Component ──────────────────────────────────────────────────────────────── */
const AlertBanner: React.FC = () => {
  const { authFetch, isAuthenticated } = useAuth();

  const [alerts, setAlerts]           = useState<CityAlert[]>([]);
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set());
  const [current, setCurrent]         = useState(0);
  const [expanded, setExpanded]       = useState(false);
  const intervalRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch active alerts ─────────────────────────────────────────────────── */
  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const r = await authFetch('/api/citizen/alerts');
      if (r.ok) {
        const data: CityAlert[] = await r.json();
        setAlerts(data);
      }
    } catch { /* silent */ }
  }, [authFetch, isAuthenticated]);

  useEffect(() => {
    fetchAlerts();
    intervalRef.current = setInterval(fetchAlerts, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAlerts]);

  /* ── Visible alerts (not individually dismissed) ─────────────────────────── */
  const visible = alerts.filter(a => !dismissed.has(a.id));

  /* ── Auto-advance ticker ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (visible.length <= 1 || expanded) return;
    const t = setInterval(() => {
      setCurrent(c => (c + 1) % visible.length);
    }, 6000);
    return () => clearInterval(t);
  }, [visible.length, expanded]);

  /* Keep current index in bounds when alerts change */
  useEffect(() => {
    if (visible.length > 0 && current >= visible.length) {
      setCurrent(visible.length - 1);
    }
  }, [visible.length, current]);

  if (visible.length === 0) return null;

  const active = visible[Math.min(current, visible.length - 1)];
  const ss = sevStyle(active.severity);
  const Icon = typeIcon(active.type);

  return (
    <div className="shrink-0">
      {/* ── Compact ticker bar ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!expanded && (
          <motion.div
            key="ticker"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 px-3 py-2 ${ss.bg} border-b ${ss.border} text-xs`}
          >
            {/* Left accent bar */}
            <span className={`w-1 h-5 rounded-full shrink-0 ${ss.bar}`} />

            {/* Bell + count badge */}
            <FiBell size={13} className={`${ss.text} shrink-0`} />
            {visible.length > 1 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ss.badge}`}>
                {visible.length}
              </span>
            )}

            {/* Type icon + title + message */}
            <Icon size={13} className={`${ss.text} shrink-0`} />
            <span className={`font-semibold ${ss.text} shrink-0`}>{active.title}</span>
            <span className="text-gray-400 truncate flex-1">{active.message}</span>
            <span className="text-gray-600 shrink-0 hidden sm:inline">{timeAgo(active.created_at)}</span>

            {/* Nav arrows (multi-alert) */}
            {visible.length > 1 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setCurrent(c => (c - 1 + visible.length) % visible.length)}
                  className="p-0.5 text-gray-500 hover:text-white transition-colors"
                  aria-label="Previous alert"
                >
                  <FiChevronLeft size={14} />
                </button>
                <span className="text-gray-600 text-[10px]">{current + 1}/{visible.length}</span>
                <button
                  onClick={() => setCurrent(c => (c + 1) % visible.length)}
                  className="p-0.5 text-gray-500 hover:text-white transition-colors"
                  aria-label="Next alert"
                >
                  <FiChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Expand */}
            <button
              onClick={() => setExpanded(true)}
              className="shrink-0 text-[10px] text-gray-500 hover:text-white border border-white/10 px-1.5 py-0.5 rounded-md transition-colors hidden sm:inline"
            >
              Details
            </button>

            {/* Dismiss this one */}
            <button
              onClick={() => setDismissed(prev => new Set([...prev, active.id]))}
              className="shrink-0 p-0.5 text-gray-600 hover:text-white transition-colors"
              aria-label="Dismiss alert"
            >
              <FiX size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-white/10 bg-[#0a1628]"
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiBell size={14} className="text-cyan-400" />
                  <span className="text-sm font-bold text-white">
                    City Alerts
                  </span>
                  <span className="text-xs text-gray-500">{visible.length} active</span>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Collapse"
                >
                  <FiX size={15} />
                </button>
              </div>

              {/* Alert cards */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {visible.map((a) => {
                  const s = sevStyle(a.severity);
                  const AIcon = typeIcon(a.type);
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-start gap-3 p-3 rounded-xl ${s.bg} border ${s.border}`}
                    >
                      <span className={`w-1 h-full min-h-[36px] rounded-full shrink-0 ${s.bar}`} />
                      <AIcon size={16} className={`${s.text} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${s.text}`}>{a.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${s.badge}`}>
                            {a.severity.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                            {a.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">{a.message}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{timeAgo(a.created_at)}</p>
                      </div>
                      <button
                        onClick={() => setDismissed(prev => new Set([...prev, a.id]))}
                        className="shrink-0 p-1 text-gray-600 hover:text-white transition-colors"
                        aria-label="Dismiss"
                      >
                        <FiX size={13} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Dismiss all */}
              {visible.length > 1 && (
                <button
                  onClick={() => {
                    setDismissed(prev => new Set([...prev, ...visible.map(a => a.id)]));
                    setExpanded(false);
                  }}
                  className="mt-3 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Dismiss all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AlertBanner;
