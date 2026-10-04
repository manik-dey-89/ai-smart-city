/**
 * Emergency.tsx — Smart City Emergency Command Center
 * Premium production-grade emergency response dashboard
 */
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertOctagon, FiPhone, FiMapPin, FiAlertCircle, FiShield,
  FiNavigation, FiLoader, FiCheckCircle, FiClock, FiRefreshCw,
  FiX, FiUser, FiActivity, FiTrendingUp,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useLocation as useLocCtx } from '../contexts/LocationContext';
import PoliceCommandCenter      from './PoliceCommandCenter';
import FireCommandCenter        from './FireCommandCenter';
import EmergencyResponderCenter from './EmergencyResponderCenter';

/* ── Leaflet icons ──────────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const makePin = (color: string) => L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 0 6px ${color}99;"></div>`,
  iconSize: [12, 12], iconAnchor: [6, 6],
});

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface EmergencyRequest {
  id: string; type: string; title: string; description: string;
  priority: string; status: string; is_resolved: boolean;
  location_lat?: number | null; location_lng?: number | null;
  created_at: string; updated_at?: string | null;
}
interface NearbyFacility {
  name: string; type: string; amenity: string;
  distance: string; distanceM: number;
  phone: string; address: string;
  lat: number; lng: number;
  color: string; icon: string;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const EMERGENCY_CATEGORIES = [
  { id: 'medical',    label: 'Medical',         icon: '🚑', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    priority: 'critical' },
  { id: 'fire',       label: 'Fire',             icon: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', priority: 'critical' },
  { id: 'police',     label: 'Police / Crime',   icon: '🚔', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   priority: 'high'     },
  { id: 'accident',   label: 'Road Accident',    icon: '💥', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', priority: 'high'     },
  { id: 'flood',      label: 'Flood / Disaster', icon: '🌊', color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   priority: 'high'     },
  { id: 'women',      label: 'Women Safety',     icon: '🆘', color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   priority: 'high'     },
  { id: 'gas',        label: 'Gas Leak',         icon: '☁️', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  priority: 'critical' },
  { id: 'general',    label: 'General',          icon: '⚠️', color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/30',   priority: 'medium'   },
];

const HOTLINES = [
  { label: 'National Emergency',  number: '112',  desc: 'All emergencies · 24×7',   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    badge: 'CRITICAL', available: true  },
  { label: 'Police',              number: '100',  desc: 'Crime · Law enforcement',  color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   badge: 'LIVE',     available: true  },
  { label: 'Fire Service',        number: '101',  desc: 'Fire · Rescue',            color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', badge: 'LIVE',     available: true  },
  { label: 'Ambulance',           number: '102',  desc: 'Medical emergencies',      color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  badge: 'LIVE',     available: true  },
  { label: 'Disaster Relief',     number: '108',  desc: 'NDRF · Natural disasters', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'LIVE',     available: true  },
  { label: 'Women Helpline',      number: '1091', desc: 'Women safety · 24×7',      color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   badge: 'LIVE',     available: true  },
  { label: 'Child Helpline',      number: '1098', desc: 'Children in distress',     color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', badge: 'LIVE',     available: true  },
  { label: 'Senior Citizen',      number: '14567',desc: 'Elder care helpline',      color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   badge: 'LIVE',     available: true  },
];

const NEARBY_TYPES = [
  { amenity: 'hospital',     label: 'Hospitals',         icon: '🏥', color: '#ef4444', mapColor: 'bg-red-400'    },
  { amenity: 'police',       label: 'Police Stations',   icon: '🚔', color: '#3b82f6', mapColor: 'bg-blue-400'   },
  { amenity: 'fire_station', label: 'Fire Stations',     icon: '🚒', color: '#f97316', mapColor: 'bg-orange-400' },
  { amenity: 'pharmacy',     label: 'Pharmacies',        icon: '💊', color: '#22c55e', mapColor: 'bg-green-400'  },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  reported:    { label: 'Reported',      color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: FiAlertOctagon },
  verified:    { label: 'Verified',      color: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: FiCheckCircle  },
  assigned:    { label: 'Assigned',      color: 'text-purple-400', bg: 'bg-purple-500/10', icon: FiUser         },
  in_progress: { label: 'Responding',    color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   icon: FiActivity     },
  resolved:    { label: 'Resolved',      color: 'text-green-400',  bg: 'bg-green-500/10',  icon: FiCheckCircle  },
  cancelled:   { label: 'Cancelled',     color: 'text-gray-400',   bg: 'bg-gray-500/10',   icon: FiX            },
};

const sm = (s: string) => STATUS_META[s] ?? { label: s, color: 'text-gray-400', bg: 'bg-gray-500/10', icon: FiClock };

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }
function fmtETA(m: number)  { const mins = Math.round(m / 1000 / 50 * 60); return mins < 2 ? '<2 min' : `~${mins} min`; }
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

/* ── Map auto-center ────────────────────────────────────────────────────────── */
const SetView: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 14); }, [lat, lng, map]);
  return null;
};

/* ══ Main Component ══════════════════════════════════════════════════════════ */
const Emergency: React.FC = () => {
  const { authFetch, user } = useAuth();
  const { data: locData, locationMode } = useLocCtx();

  /* ── Local GPS state (Emergency-panel-only, does NOT overwrite LocationContext) ── */
  const [gpsLat, setGpsLat]         = useState<number | null>(null);
  const [gpsLng, setGpsLng]         = useState<number | null>(null);
  const [gpsAddr, setGpsAddr]       = useState('');
  const [gpsAcc, setGpsAcc]         = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  // Whether the Emergency panel is using its own GPS pin vs. the shared manual location
  const [usingLocalGPS, setUsingLocalGPS] = useState(false);

  /* SOS flow */
  const [selectedCat, setSelectedCat]   = useState<string | null>(null);
  const [sosStep, setSosStep]           = useState<'idle' | 'confirm' | 'sending' | 'done'>('idle');
  const [sosDescription, setSosDescription] = useState('');
  const [sosError, setSosError]         = useState('');
  const [latestSOS, setLatestSOS]       = useState<EmergencyRequest | null>(null);

  /* My requests */
  const [myRequests, setMyRequests]     = useState<EmergencyRequest[]>([]);
  const [loadingMy, setLoadingMy]       = useState(false);

  /* Nearby */
  const [nearby, setNearby]             = useState<NearbyFacility[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [activeNearbyType, setActiveNearbyType] = useState('hospital');
  const [nearbyFetched, setNearbyFetched] = useState(false);

  /* City location from dashboard search (manual or previous auto) */
  const cityLoc = locData?.location;

  // Active display location: local GPS pin (if user explicitly tapped GPS in Emergency)
  // OR the shared location from LocationContext (which respects manual/auto mode).
  const displayLat  = usingLocalGPS && gpsLat  ? gpsLat  : (cityLoc?.lat  ?? 22.5726);
  const displayLng  = usingLocalGPS && gpsLng  ? gpsLng  : (cityLoc?.lng  ?? 88.3639);
  const displayAddr = usingLocalGPS && gpsAddr ? gpsAddr : (cityLoc ? `${cityLoc.city}, ${cityLoc.state}` : '');
  const displayAcc  = usingLocalGPS ? gpsAcc : null;

  /* ── GPS (only runs when user explicitly taps the GPS button) ──────────── */
  const getGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsLat(latitude); setGpsLng(longitude); setGpsAcc(Math.round(accuracy));
        setUsingLocalGPS(true);
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'SmartCityDashboard/1.0' } }
          );
          const j = await r.json();
          setGpsAddr(j.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } catch {
          setGpsAddr(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // NO auto-GPS useEffect — GPS is only triggered when user explicitly taps the button.
  // If LocationContext is in auto mode AND no city data yet, fetch GPS once on mount.
  useEffect(() => {
    if (locationMode === 'auto' && !locData && !gpsLat) {
      getGPS();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  /* ── Load my requests ─────────────────────────────────────────────────── */
  const loadMyRequests = useCallback(async () => {
    setLoadingMy(true);
    try {
      const r = await authFetch('/api/citizen/emergency/my');
      if (r.ok) setMyRequests(await r.json());
    } catch { /* silent */ }
    finally { setLoadingMy(false); }
  }, [authFetch]);

  useEffect(() => { loadMyRequests(); }, [loadMyRequests]);

  /* ── Submit SOS ───────────────────────────────────────────────────────── */
  const submitSOS = async () => {
    if (!selectedCat) return;
    const cat = EMERGENCY_CATEGORIES.find(c => c.id === selectedCat)!;
    setSosStep('sending'); setSosError('');
    try {
      const res = await authFetch('/api/citizen/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: cat.label,
          title: `${cat.label} Emergency`,
          description: sosDescription || `${cat.label} emergency reported by citizen`,
          location_lat: displayLat !== 22.5726 ? displayLat : null,
          location_lng: displayLng !== 88.3639 ? displayLng : null,
          priority: cat.priority,
        }),
      });
      if (!res.ok) { setSosError('Failed to submit. Please call 112.'); setSosStep('confirm'); return; }
      const data: EmergencyRequest = await res.json();
      setLatestSOS(data);
      setSosStep('done');
      loadMyRequests();
      setSosDescription('');
    } catch {
      setSosError('Network error. Please call 112 immediately.');
      setSosStep('confirm');
    }
  };

  const resetSOS = () => {
    setSosStep('idle'); setSelectedCat(null); setSosDescription(''); setSosError('');
  };

  /* ── Fetch nearby via backend (cached Overpass) ──────────────────────── */
  const fetchNearby = useCallback(async (lat: number, lng: number, amenity: string) => {
    setNearbyLoading(true);
    const typeInfo = NEARBY_TYPES.find(t => t.amenity === amenity)!;
    try {
      // Map amenity to layer
      const layerMap: Record<string, string> = {
        hospital:     'emergency',
        police:       'emergency',
        fire_station: 'emergency',
        pharmacy:     'emergency',
      };
      const layer = layerMap[amenity] || 'sensors';

      // Use backend /api/map/markers — has 10-min cache, much faster than raw Overpass
      const r = await authFetch(
        `/api/map/markers?layer=${layer}&lat=${lat}&lng=${lng}&radius=5000`
      );
      if (!r.ok) { setNearby([]); return; }
      const data = await r.json();
      const markers: any[] = (data.markers || []);

      // Filter to the requested amenity type
      const typeMap: Record<string, string> = {
        hospital: 'hospital', police: 'police',
        fire_station: 'fire', pharmacy: 'pharmacy',
      };
      const targetType = typeMap[amenity] || amenity;

      const list: NearbyFacility[] = markers
        .filter((m: any) => m.type === targetType)
        .slice(0, 6)
        .map((m: any) => {
          const distM = haversineM(lat, lng, m.lat, m.lng);
          const parts = (m.status || '').split(' · ');
          const phone = parts.find((p: string) => p.startsWith('+') || /^\d{3}/.test(p)) || '';
          return {
            name:      m.name || typeInfo.label,
            type:      typeInfo.label.slice(0, -1),
            amenity,
            distance:  fmtDist(distM),
            distanceM: distM,
            phone,
            address:   '',
            lat: m.lat, lng: m.lng,
            color: typeInfo.color, icon: typeInfo.icon,
          };
        })
        .sort((a, b) => a.distanceM - b.distanceM);

      setNearby(list);
    } catch { setNearby([]); }
    finally { setNearbyLoading(false); setNearbyFetched(true); }
  }, [authFetch]);

  useEffect(() => {
    fetchNearby(displayLat, displayLng, activeNearbyType);
  }, [activeNearbyType, displayLat, displayLng, fetchNearby]);

  const catInfo = selectedCat ? EMERGENCY_CATEGORIES.find(c => c.id === selectedCat) : null;

  return (
    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', paddingBottom: 48 }}>
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <FiAlertOctagon size={22} className="text-red-400" />
              Emergency Command Center
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {user?.full_name || user?.username} · Smart City Emergency Services
            </p>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-semibold">National Helplines Active</span>
          </div>
        </div>

        {/* ━━ Info banner ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex items-start gap-3 p-3.5 bg-blue-500/8 border border-blue-500/20 rounded-xl text-xs text-blue-300 mb-5">
          <FiAlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            <strong className="text-blue-400">Smart City Emergency System — Active.</strong>{' '}
            SOS requests are recorded and routed to the relevant department in real-time.
            For life-threatening emergencies, <strong className="text-white">call 112 immediately</strong> — do not wait for digital response.
          </span>
        </div>

        {/* ━━ Main grid ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5"
          style={{ alignItems: 'start' }}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            {/* ── SOS Action Center ─────────────────────────────────────── */}
            <div className="glass-card p-5 border border-red-500/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <FiAlertOctagon size={16} className="text-red-400" /> Emergency SOS
                </h2>
                {sosStep !== 'idle' && sosStep !== 'done' && (
                  <button onClick={resetSOS} className="text-xs text-gray-500 hover:text-gray-300 transition-all">
                    Cancel
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">

                {/* Step 1: Category selection */}
                {sosStep === 'idle' && (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-xs text-gray-500 mb-3">Select emergency type to begin SOS:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {EMERGENCY_CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => { setSelectedCat(cat.id); setSosStep('confirm'); }}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold
                            transition-all hover:scale-[1.03] active:scale-95
                            ${cat.bg} ${cat.border} ${cat.color}`}>
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-center leading-tight">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-700 mt-3 text-center">
                      Tap a category → confirm details → submit to Smart City system
                    </p>
                  </motion.div>
                )}

                {/* Step 2: Confirm */}
                {sosStep === 'confirm' && catInfo && (
                  <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-4">
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${catInfo.bg} border ${catInfo.border}`}>
                      <span className="text-2xl">{catInfo.icon}</span>
                      <div>
                        <p className={`font-bold text-sm ${catInfo.color}`}>{catInfo.label} Emergency</p>
                        <p className="text-xs text-gray-500">Priority: {catInfo.priority.toUpperCase()}</p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="bg-white/5 rounded-xl p-3 flex items-start gap-2">
                      <FiMapPin size={13} className="text-cyan-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 truncate">
                          {displayAddr || 'Location not set'}
                        </p>
                        {displayAcc !== null && (
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            GPS accuracy: ±{displayAcc}m · {displayLat?.toFixed(5)}, {displayLng?.toFixed(5)}
                          </p>
                        )}
                        {!usingLocalGPS && !cityLoc && (
                          <button onClick={getGPS}
                            className="text-[10px] text-cyan-400 hover:underline mt-0.5 flex items-center gap-1">
                            {gpsLoading ? <FiLoader size={9} className="animate-spin" /> : <FiNavigation size={9} />}
                            {gpsLoading ? 'Getting GPS…' : 'Use GPS location'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional description */}
                    <textarea value={sosDescription}
                      onChange={e => setSosDescription(e.target.value)}
                      placeholder="Additional details (optional) — describe the situation..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white
                                 text-xs placeholder-gray-600 focus:outline-none focus:border-red-500/40
                                 transition-all resize-none" />

                    {sosError && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5">
                        <FiAlertCircle size={11} /> {sosError}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button onClick={submitSOS}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-bold text-sm
                                   rounded-xl transition-all flex items-center justify-center gap-2
                                   shadow-lg shadow-red-500/25">
                        <FiAlertOctagon size={15} /> Confirm &amp; Submit SOS
                      </button>
                      <button onClick={resetSOS}
                        className="px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl
                                   text-sm transition-all border border-white/10">
                        Back
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Sending */}
                {sosStep === 'sending' && (
                  <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500/40
                                    flex items-center justify-center mx-auto animate-pulse">
                      <FiAlertOctagon size={22} className="text-red-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">Submitting Emergency Request…</p>
                    <p className="text-xs text-gray-500">Sending to Smart City Emergency System</p>
                  </motion.div>
                )}

                {/* Step 4: Done */}
                {sosStep === 'done' && latestSOS && (
                  <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="space-y-4">
                    <div className="text-center py-3">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500/40
                                      flex items-center justify-center mx-auto mb-3">
                        <FiCheckCircle size={22} className="text-green-400" />
                      </div>
                      <p className="font-bold text-green-400">SOS Submitted</p>
                      <p className="text-xs text-gray-500 mt-0.5">Your request is now in the system</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="text-white font-medium">{latestSOS.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className="text-yellow-400 font-semibold capitalize">{latestSOS.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">ID</span>
                        <span className="text-xs font-mono text-gray-400">{latestSOS.id.slice(0, 12)}…</span>
                      </div>
                    </div>
                    <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl">
                      <p className="text-xs text-red-300 font-semibold">⚠ Life-threatening? Call 112 now.</p>
                      <a href="tel:112"
                        className="mt-2 w-full flex items-center justify-center gap-2 py-2.5
                                   bg-red-500 hover:bg-red-400 text-white font-bold text-sm rounded-xl transition-all">
                        <FiPhone size={14} /> Call 112 Now
                      </a>
                    </div>
                    <button onClick={resetSOS}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10
                                 text-gray-400 text-sm rounded-xl transition-all">
                      Submit Another SOS
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Quick Call Strip ───────────────────────────────────────── */}
            <div className="glass-card p-5">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4">
                <FiPhone size={15} className="text-cyan-400" /> One-Tap Emergency Calls
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {HOTLINES.slice(0, 4).map(h => (
                  <a key={h.number} href={`tel:${h.number}`}
                    className={`flex flex-col gap-1.5 p-3.5 rounded-xl border ${h.bg} ${h.border}
                                hover:opacity-85 active:scale-95 transition-all group`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xl font-extrabold ${h.color} leading-none`}>{h.number}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${h.bg} ${h.color} border ${h.border}`}>
                        {h.badge}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white">{h.label}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{h.desc}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <FiPhone size={10} className={h.color} />
                      <span className={`text-[10px] font-medium ${h.color}`}>Tap to Call</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* ── All Hotlines ───────────────────────────────────────────── */}
            <div className="glass-card p-5">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4">
                <FiShield size={15} className="text-purple-400" /> All Emergency Hotlines (India)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HOTLINES.map(h => (
                  <a key={h.number} href={`tel:${h.number}`}
                    className={`flex items-center justify-between p-3 rounded-xl border ${h.bg} ${h.border}
                                hover:opacity-85 transition-all`}>
                    <div>
                      <p className="text-[10px] text-gray-400">{h.label}</p>
                      <p className={`text-xl font-extrabold ${h.color} leading-tight`}>{h.number}</p>
                    </div>
                    <FiPhone size={15} className={`${h.color} opacity-60`} />
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-gray-700 mt-3">
                All numbers are verified Indian government emergency helplines · Available 24×7
              </p>
            </div>

            {/* ── My Emergency Requests ──────────────────────────────────── */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <FiActivity size={15} className="text-yellow-400" /> My Emergency Requests
                </h2>
                <button onClick={loadMyRequests} disabled={loadingMy}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-all">
                  <FiRefreshCw size={12} className={loadingMy ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              {loadingMy && (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
                  <FiLoader size={18} className="animate-spin text-yellow-400" /> Loading…
                </div>
              )}
              {!loadingMy && myRequests.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <FiActivity size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No emergency requests submitted yet.</p>
                </div>
              )}
              {!loadingMy && myRequests.length > 0 && (
                <div className="space-y-2.5">
                  {myRequests.slice(0, 5).map((req, i) => {
                    const meta = sm(req.status);
                    const Icon = meta.icon;
                    return (
                      <motion.div key={req.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start justify-between gap-3 p-3.5 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-white truncate">{req.title}</p>
                            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded capitalize">
                              {req.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{fmtDate(req.created_at)}</p>
                        </div>
                        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium shrink-0 ${meta.bg} ${meta.color}`}>
                          <Icon size={10} /> {meta.label}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            {/* ── Live Location Card ─────────────────────────────────────── */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <FiNavigation size={14} className="text-cyan-400" /> Your Location
                  {locationMode === 'manual' && !usingLocalGPS && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                      Manual
                    </span>
                  )}
                  {usingLocalGPS && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                      GPS
                    </span>
                  )}
                </h2>
                <button onClick={getGPS} disabled={gpsLoading}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline disabled:opacity-50 transition-all">
                  {gpsLoading ? <FiLoader size={11} className="animate-spin" /> : <FiNavigation size={11} />}
                  {gpsLoading ? 'Getting GPS…' : 'Use My GPS'}
                </button>
              </div>

              {displayAddr && (
                <div className="flex items-start gap-2 mb-3 p-2.5 bg-white/5 rounded-lg">
                  <FiMapPin size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{displayAddr}</p>
                    {displayAcc !== null && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        ±{displayAcc}m accuracy · {displayLat?.toFixed(5)}, {displayLng?.toFixed(5)}
                      </p>
                    )}
                    {/* Show switch-back option when Emergency is using GPS but context has a manual city */}
                    {usingLocalGPS && cityLoc && (
                      <button onClick={() => setUsingLocalGPS(false)}
                        className="text-[10px] text-yellow-400 hover:underline mt-1 flex items-center gap-1">
                        <FiMapPin size={9} /> Switch back to {cityLoc.city}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Map preview */}
              <div style={{ height: 'clamp(160px, 35vw, 220px)', width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <MapContainer
                  center={[displayLat, displayLng]} zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© OpenStreetMap' />
                  <SetView lat={displayLat} lng={displayLng} />
                  <Marker position={[displayLat, displayLng]} icon={makePin('#ef4444')}>
                    <Popup><span className="text-xs font-semibold">Your Location</span></Popup>
                  </Marker>
                  {nearby.map((f, i) => (
                    <Marker key={i} position={[f.lat, f.lng]} icon={makePin(f.color)}>
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">{f.icon} {f.name}</p>
                          <p className="text-gray-500">{f.distance}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {!displayAddr && (
                <button onClick={getGPS}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-cyan-500/15
                             border border-cyan-500/30 text-cyan-400 text-sm font-semibold rounded-xl
                             hover:bg-cyan-500/25 transition-all">
                  <FiNavigation size={13} /> Use Current Location
                </button>
              )}
            </div>

            {/* ── Nearby Emergency Services ─────────────────────────────── */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <FiShield size={14} className="text-green-400" /> Nearby Services
                </h2>
                {nearbyLoading && <FiLoader size={13} className="animate-spin text-gray-500" />}
              </div>

              {/* Type tabs */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                {NEARBY_TYPES.map(t => (
                  <button key={t.amenity}
                    onClick={() => setActiveNearbyType(t.amenity)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border
                      ${activeNearbyType === t.amenity
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/5 border-white/8 text-gray-500 hover:border-white/15'}`}>
                    <span>{t.icon}</span> {t.label.slice(0, -1)}s
                  </button>
                ))}
              </div>

              {nearbyLoading && (
                <div className="py-6 text-center text-gray-600 text-xs flex items-center justify-center gap-2">
                  <FiLoader size={14} className="animate-spin" /> Searching Overpass API…
                </div>
              )}
              {!nearbyLoading && nearbyFetched && nearby.length === 0 && (
                <div className="py-6 text-center text-gray-600 text-xs">
                  <p>No {NEARBY_TYPES.find(t=>t.amenity===activeNearbyType)?.label.toLowerCase()} found within 5 km.</p>
                  <p className="mt-1 text-gray-700">Data from OpenStreetMap — coverage may vary.</p>
                </div>
              )}

              <div className="space-y-2.5">
                {nearby.map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5
                               hover:border-white/10 transition-all">
                    <span className="text-xl shrink-0">{f.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{f.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiMapPin size={9} /> {f.distance}
                        </span>
                        <span className="flex items-center gap-1">
                          <FiClock size={9} /> {fmtETA(f.distanceM)}
                        </span>
                        {f.phone && (
                          <a href={`tel:${f.phone}`}
                            className="flex items-center gap-1 text-green-400 hover:underline">
                            <FiPhone size={9} /> {f.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10
                                   border border-blue-500/20 px-2 py-1 rounded-lg hover:opacity-80 transition-all">
                        <FiNavigation size={9} /> Go
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-gray-700 mt-3">
                Data: OpenStreetMap · Overpass API · Within 5 km · Sorted by distance
              </p>
            </div>

            {/* ── Emergency Status Legend ────────────────────────────────── */}
            <div className="glass-card p-5">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4">
                <FiTrendingUp size={14} className="text-orange-400" /> Request Status Guide
              </h2>
              <div className="space-y-2">
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <div key={key} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${meta.bg} text-xs`}>
                      <Icon size={12} className={meta.color} />
                      <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className="text-gray-600 text-[10px] ml-auto capitalize">{key.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>{/* end right */}
        </div>{/* end grid */}
      </div>{/* end container */}
    </div>/* end outer */
  );
};

/* ══ Role-aware wrapper ══════════════════════════════════════════════════════ */
const EmergencyPage: React.FC = () => {
  const { user } = useAuth();
  const role = user?.roles?.[0]?.name || 'citizen';

  if (role === 'police')       return <PoliceCommandCenter />;
  if (role === 'fire_service') return <FireCommandCenter />;
  if (role === 'emergency')    return <EmergencyResponderCenter />;

  // Default: citizen emergency panel
  return <Emergency />;
};

export default EmergencyPage;
