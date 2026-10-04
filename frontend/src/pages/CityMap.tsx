/**
 * CityMap.tsx — Smart City Interactive Map
 * Real data: OSM facilities (hospitals/police/fire) via Overpass API
 *           + DB emergency requests + DB complaints + DB traffic incidents
 * Map modes: OpenStreetMap | Satellite | Dark
 * Layers:    Emergency | Traffic | Sensors (Complaints) | All
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, useMap, Circle,
} from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCrosshair, FiSearch, FiLoader, FiRefreshCw, FiLayers,
  FiAlertOctagon, FiAlertCircle, FiShield, FiMapPin,
  FiActivity, FiInfo,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useLocation as useLocCtx } from '../contexts/LocationContext';

/* ── Leaflet icon fix ───────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface MapMarker {
  id: string;
  type: string;
  lat: number;
  lng: number;
  name: string;
  status?: string;
  fill_percentage?: number;
}

/* ── Marker config ───────────────────────────────────────────────────────────── */
const MARKER_CONFIG: Record<string, { color: string; emoji: string; label: string; layer: string }> = {
  // Emergency & medical
  hospital:           { color: '#ef4444', emoji: '🏥', label: 'Hospital',           layer: 'emergency' },
  clinic:             { color: '#f87171', emoji: '🏥', label: 'Clinic',             layer: 'emergency' },
  pharmacy:           { color: '#22c55e', emoji: '💊', label: 'Pharmacy',           layer: 'emergency' },
  ambulance:          { color: '#dc2626', emoji: '🚑', label: 'Ambulance Station',  layer: 'emergency' },
  police:             { color: '#3b82f6', emoji: '🚔', label: 'Police Station',     layer: 'emergency' },
  fire:               { color: '#f97316', emoji: '🚒', label: 'Fire Station',       layer: 'emergency' },
  emergency_sos:      { color: '#dc2626', emoji: '🆘', label: 'SOS Request',        layer: 'emergency' },
  complaint_crime:    { color: '#7c3aed', emoji: '⚖️', label: 'Crime Report',       layer: 'emergency' },
  complaint_fire:     { color: '#ea580c', emoji: '🔥', label: 'Fire Complaint',     layer: 'emergency' },
  complaint_medical:  { color: '#e11d48', emoji: '🚑', label: 'Medical Complaint',  layer: 'emergency' },
  // Transport & traffic
  fuel:               { color: '#eab308', emoji: '⛽', label: 'Fuel Station',       layer: 'traffic'   },
  bus_stop:           { color: '#84cc16', emoji: '🚌', label: 'Bus Station',        layer: 'traffic'   },
  parking:            { color: '#64748b', emoji: '🅿', label: 'Parking',            layer: 'traffic'   },
  traffic_incident:   { color: '#fbbf24', emoji: '🚧', label: 'Traffic Incident',   layer: 'traffic'   },
  complaint_traffic:  { color: '#f59e0b', emoji: '🛣',  label: 'Road Complaint',    layer: 'traffic'   },
  // Services & sensors
  bank:               { color: '#0ea5e9', emoji: '🏦', label: 'Bank',               layer: 'sensors'   },
  atm:                { color: '#38bdf8', emoji: '🏧', label: 'ATM',               layer: 'sensors'   },
  supermarket:        { color: '#a78bfa', emoji: '🛒', label: 'Supermarket',        layer: 'sensors'   },
  market:             { color: '#c084fc', emoji: '🏪', label: 'Market',             layer: 'sensors'   },
  post_office:        { color: '#f472b6', emoji: '📮', label: 'Post Office',        layer: 'sensors'   },
  school:             { color: '#4ade80', emoji: '🏫', label: 'School',             layer: 'sensors'   },
  college:            { color: '#34d399', emoji: '🎓', label: 'College/University', layer: 'sensors'   },
  university:         { color: '#34d399', emoji: '🎓', label: 'University',         layer: 'sensors'   },
  library:            { color: '#fb923c', emoji: '📚', label: 'Library',            layer: 'sensors'   },
  complaint_general:  { color: '#06b6d4', emoji: '📍', label: 'Citizen Report',     layer: 'sensors'   },
  place:              { color: '#6b7280', emoji: '📍', label: 'Place',              layer: 'sensors'   },
};

const getConfig = (type: string) => MARKER_CONFIG[type] ?? { color: '#6b7280', emoji: '📍', label: type, layer: 'sensors' };

const makeIcon = (type: string) => {
  const cfg = getConfig(type);
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;
      background:${cfg.color};
      border:2.5px solid rgba(255,255,255,0.85);
      box-shadow:0 0 10px ${cfg.color}88,0 2px 6px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:16px;line-height:1;
    ">${cfg.emoji}</div>`,
    iconSize:   [34, 34],
    iconAnchor: [17, 34],
    popupAnchor:[0, -36],
  });
};

const GPS_ICON = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#22d3ee;border:3px solid white;box-shadow:0 0 12px #22d3ee99;"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9],
});

/* ── Base map options ────────────────────────────────────────────────────────── */
const BASE_MAPS = [
  {
    id: 'osm', name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  },
  {
    id: 'satellite', name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, USGS, NOAA',
  },
  {
    id: 'dark', name: 'Dark',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
  },
];

const LAYERS = [
  { id: 'all',       label: 'All',       icon: FiLayers,       color: 'text-cyan-400'   },
  { id: 'emergency', label: 'Emergency', icon: FiAlertOctagon,  color: 'text-red-400'    },
  { id: 'traffic',   label: 'Traffic',   icon: FiActivity,     color: 'text-yellow-400' },
  { id: 'sensors',   label: 'Services',  icon: FiMapPin,       color: 'text-blue-400'   },
];

/* ── Map re-center helper ────────────────────────────────────────────────────── */
const SetView: React.FC<{ lat: number; lng: number; zoom?: number }> = ({ lat, lng, zoom = 13 }) => {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (key !== prev.current) {
      map.setView([lat, lng], zoom);
      prev.current = key;
    }
  }, [lat, lng, zoom, map]);
  return null;
};

/* ── Nominatim search input ──────────────────────────────────────────────────── */
interface Suggestion { display_name: string; lat: string; lon: string }
const SearchBox: React.FC<{
  onSelect: (lat: number, lng: number, name: string) => void;
}> = ({ onSelect }) => {
  const [q, setQ]       = useState('');
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (val: string) => {
    if (val.trim().length < 3) { setSugs([]); return; }
    setBusy(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'SmartCityDashboard/1.0' } }
      );
      setSugs(await r.json()); setOpen(true);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <FiSearch size={14} className="absolute left-3 text-gray-500" />
        {busy && <FiLoader size={12} className="absolute right-3 animate-spin text-gray-500" />}
        <input value={q}
          onChange={e => { setQ(e.target.value); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => search(e.target.value), 420); }}
          onFocus={() => sugs.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search city, area or location…"
          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-8 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
      </div>
      <AnimatePresence>
        {open && sugs.length > 0 && (
          <motion.ul initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="absolute z-[9999] w-full mt-1 glass-card border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {sugs.map((s, i) => (
              <li key={i} onMouseDown={() => { onSelect(parseFloat(s.lat), parseFloat(s.lon), s.display_name); setQ(s.display_name.split(',')[0]); setOpen(false); }}
                className="px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 truncate">
                <FiMapPin size={9} className="inline mr-1.5 text-cyan-400" />{s.display_name}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ══ Main Component ══════════════════════════════════════════════════════════ */
const CityMap: React.FC = () => {
  const { authFetch } = useAuth();
  const { data: locData } = useLocCtx();

  const [baseMap,   setBaseMap]   = useState('osm');
  const [layer,     setLayer]     = useState('all');
  const [markers,   setMarkers]   = useState<MapMarker[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [gpsLat,    setGpsLat]    = useState<number | null>(null);
  const [gpsLng,    setGpsLng]    = useState<number | null>(null);
  const [gpsLoading,setGpsLoading]= useState(false);
  const [mapLat,    setMapLat]    = useState(22.5726);
  const [mapLng,    setMapLng]    = useState(88.3639);
  const [locationLabel, setLocationLabel] = useState('');
  const [mapKey, setMapKey] = useState('osm-22.5726-88.3639');

  // Sync from LocationContext when city searched on dashboard
  useEffect(() => {
    if (locData?.location) {
      const newLat = locData.location.lat;
      const newLng = locData.location.lng;
      setMapLat(newLat);
      setMapLng(newLng);
      setLocationLabel(`${locData.location.city}, ${locData.location.state}`);
      setMapKey(`${baseMap}-${newLat.toFixed(4)}-${newLng.toFixed(4)}`);
    }
  }, [locData?.location?.lat, locData?.location?.lng]);

  /* ── Fetch markers from backend ─────────────────────────────────────────── */
  const fetchMarkers = useCallback(async (lat: number, lng: number, activeLayer: string) => {
    setLoading(true); setError('');
    try {
      // Try with a 12s timeout — backend caches so second call is instant
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      const r = await authFetch(
        `/api/map/markers?layer=${activeLayer}&lat=${lat}&lng=${lng}&radius=6000`,
        { signal: controller.signal }
      );
      clearTimeout(tid);
      if (!r.ok) { setError('Could not load map data'); return; }
      const data = await r.json();
      setMarkers(data.markers || []);
    } catch (e: any) {
      if (e?.name === 'AbortError') setError('Map data timed out — Overpass API is busy. Try again shortly.');
      else setError('Network error loading map');
    }
    finally { setLoading(false); }
  }, [authFetch]);

  // Fetch when location or layer changes
  useEffect(() => {
    fetchMarkers(mapLat, mapLng, layer);
  }, [mapLat, mapLng, layer, fetchMarkers]);

  /* ── GPS ─────────────────────────────────────────────────────────────────── */
  const useGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setGpsLat(latitude); setGpsLng(longitude);
        setMapLat(latitude); setMapLng(longitude);
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'SmartCityDashboard/1.0' } }
          );
          const j = await r.json();
          const addr = j.address;
          setLocationLabel(addr.city || addr.town || addr.village || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch { setLocationLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`); }
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  /* ── Stats ───────────────────────────────────────────────────────────────── */
  const EMERGENCY_TYPES = ['hospital','clinic','pharmacy','ambulance','police','fire','emergency_sos','complaint_crime','complaint_fire','complaint_medical'];
  const TRAFFIC_TYPES   = ['fuel','bus_stop','parking','traffic_incident','complaint_traffic'];
  const SERVICE_TYPES   = ['bank','atm','supermarket','market','post_office','school','college','university','library','complaint_general'];
  const FACILITY_TYPES  = ['hospital','clinic','pharmacy','ambulance','police','fire'];

  const stats = [
    { label: 'Emergency',  count: markers.filter(m => EMERGENCY_TYPES.includes(m.type)).length, color: 'text-red-400',    icon: FiAlertOctagon },
    { label: 'Traffic',    count: markers.filter(m => TRAFFIC_TYPES.includes(m.type)).length,   color: 'text-yellow-400', icon: FiActivity     },
    { label: 'Services',   count: markers.filter(m => SERVICE_TYPES.includes(m.type)).length,   color: 'text-blue-400',   icon: FiMapPin       },
    { label: 'Facilities', count: markers.filter(m => FACILITY_TYPES.includes(m.type)).length,  color: 'text-green-400',  icon: FiShield       },
  ];

  // Group for legend
  const visibleTypes = [...new Set(markers.map(m => m.type))];

  return (
    <div className="space-y-4 pb-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <FiMapPin size={22} className="text-cyan-400" /> Live City Map
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time emergency facilities · Complaints · Traffic incidents
            {locationLabel && <> · <span className="text-cyan-400">{locationLabel}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchMarkers(mapLat, mapLng, layer)} disabled={loading}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all disabled:opacity-50">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={useGPS} disabled={gpsLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
            {gpsLoading ? <FiLoader size={14} className="animate-spin" /> : <FiCrosshair size={14} />}
            {gpsLoading ? 'Getting GPS…' : 'My Location'}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, count, color, icon: Icon }) => (
          <div key={label} className="glass-card p-4">
            <Icon size={16} className={`${color} mb-1`} />
            <p className={`text-2xl font-extrabold ${color}`}>{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Controls row ── */}
      <div className="glass-card p-4 space-y-3">
        {/* Search */}
        <SearchBox onSelect={(lat, lng, name) => {
          setMapLat(lat); setMapLng(lng);
          setLocationLabel(name.split(',')[0]);
        }} />

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Base map selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Map:</span>
            {BASE_MAPS.map(bm => (
              <button key={bm.id}
                onClick={() => { setBaseMap(bm.id); setMapKey(`${bm.id}-${mapLat.toFixed(4)}-${mapLng.toFixed(4)}`); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  baseMap === bm.id
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}>
                {bm.id === 'osm' ? '🗺' : bm.id === 'satellite' ? '🛰' : '🌑'} {bm.name}
              </button>
            ))}
          </div>

          {/* Layer selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Layer:</span>
            {LAYERS.map(({ id, label, icon: Icon, color }) => (
              <button key={id} onClick={() => setLayer(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  layer === id
                    ? `bg-white/10 border-white/25 ${color}`
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}>
                <Icon size={12} /> {label}
                {loading && layer === id && <FiLoader size={10} className="animate-spin ml-0.5" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <FiAlertCircle size={14} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Map ── */}
      <div className="glass-card overflow-hidden" style={{ height: 'clamp(320px, 55vw, 580px)' }}>
        <MapContainer
          key={mapKey}
          center={[mapLat, mapLng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          {/* Base tile layer */}
          {BASE_MAPS.map(bm => (
            baseMap === bm.id && (
              <TileLayer key={bm.id} url={bm.url} attribution={bm.attribution} />
            )
          ))}

          {/* Re-center when location changes */}
          <SetView lat={mapLat} lng={mapLng} zoom={13} />

          {/* GPS position */}
          {gpsLat && gpsLng && (
            <Marker position={[gpsLat, gpsLng]} icon={GPS_ICON}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">📍 Your Location</p>
                  <p className="text-gray-500">{gpsLat.toFixed(5)}, {gpsLng.toFixed(5)}</p>
                </div>
              </Popup>
            </Marker>
          )}
          {gpsLat && gpsLng && (
            <Circle center={[gpsLat, gpsLng]} radius={8000}
              pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 0.04, weight: 1, dashArray: '5,8' }} />
          )}

          {/* Data markers */}
          {markers.map(m => {
            const icon = makeIcon(m.type);
            const cfg  = getConfig(m.type);
            return (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={icon}>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                      <p style={{ fontWeight: 700, color: cfg.color, fontSize: 13 }}>{cfg.label}</p>
                    </div>
                    <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{m.name}</p>
                    {m.status && <p style={{ fontSize: 11, color: '#6b7280' }}>{m.status}</p>}
                    {m.fill_percentage !== undefined && (
                      <div style={{ marginTop: 6 }}>
                        <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Fill: {m.fill_percentage}%</p>
                        <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${m.fill_percentage}%`,
                            background: m.fill_percentage > 80 ? '#ef4444' : m.fill_percentage > 50 ? '#eab308' : '#22c55e',
                          }} />
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                      {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ── Legend ── */}
      {visibleTypes.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <FiInfo size={12} /> Map Legend
          </h3>
          <div className="flex flex-wrap gap-3">
            {visibleTypes.map(type => {
              const cfg = getConfig(type);
              const count = markers.filter(m => m.type === type).length;
              return (
                <div key={type} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0"
                    style={{ background: cfg.color + '22', border: `1.5px solid ${cfg.color}` }}>
                    {cfg.emoji}
                  </div>
                  <span className="text-xs text-gray-300">{cfg.label}</span>
                  <span className="text-xs font-bold ml-1" style={{ color: cfg.color }}>{count}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-700 mt-3">
            Emergency facilities: OpenStreetMap via Overpass API · Complaints & incidents: Smart City database · Data within 8 km radius
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && markers.length === 0 && !error && (
        <div className="glass-card p-10 text-center">
          <FiMapPin size={36} className="mx-auto mb-3 text-gray-600" />
          <p className="text-white font-semibold">No data in this area</p>
          <p className="text-sm text-gray-500 mt-1">
            Try searching a different city or use "My Location" for real nearby facilities.
          </p>
        </div>
      )}
    </div>
  );
};

export default CityMap;
