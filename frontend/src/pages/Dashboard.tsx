import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiMapPin, FiLoader, FiAlertCircle, FiRefreshCw,
  FiSun, FiCloud, FiCloudRain, FiCloudLightning, FiCloudSnow,
  FiWind, FiDroplet, FiTruck, FiArrowRight, FiThermometer,
} from 'react-icons/fi';
import { useLocation as useLocCtx } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';

// ─── WMO helpers ─────────────────────────────────────────────────────────────
function wmoIcon(code: number): { Icon: React.ElementType; color: string } {
  if (code === 0 || code === 1)  return { Icon: FiSun,            color: 'text-yellow-400' };
  if (code <= 3)                 return { Icon: FiCloud,           color: 'text-gray-300'   };
  if (code <= 48)                return { Icon: FiCloud,           color: 'text-gray-400'   };
  if (code <= 67)                return { Icon: FiCloudRain,       color: 'text-cyan-400'   };
  if (code <= 77)                return { Icon: FiCloudSnow,       color: 'text-blue-200'   };
  if (code <= 82)                return { Icon: FiCloudRain,       color: 'text-blue-400'   };
  return { Icon: FiCloudLightning, color: 'text-orange-400' };
}

function aqiColor(v: number | null) {
  if (v == null)  return 'text-gray-400';
  if (v <= 50)    return 'text-green-400';
  if (v <= 100)   return 'text-yellow-400';
  if (v <= 150)   return 'text-orange-400';
  if (v <= 200)   return 'text-red-400';
  return 'text-purple-400';
}

function trafficColor(status: string): string {
  switch (status) {
    case 'Free Flow':     return 'text-green-400';
    case 'Light Traffic': return 'text-lime-400';
    case 'Moderate':      return 'text-yellow-400';
    case 'Heavy':         return 'text-orange-400';
    case 'Standstill':    return 'text-red-400';
    default:              return 'text-gray-400';
  }
}

function trafficTag(status: string): { label: string; color: string } {
  switch (status) {
    case 'Free Flow':     return { label: 'Live', color: 'bg-green-500/10 text-green-400 border border-green-500/20' };
    case 'Light Traffic': return { label: 'Live', color: 'bg-lime-500/10 text-lime-400 border border-lime-500/20' };
    case 'Moderate':      return { label: 'Live', color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' };
    case 'Heavy':         return { label: 'Live', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
    case 'Standstill':    return { label: 'Live', color: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    default:              return { label: 'N/A',  color: 'bg-gray-500/10 text-gray-500 border border-gray-500/20' };
  }
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
const fmt = (v: number | null | undefined, unit = '', d = 1) =>
  v != null ? `${v.toFixed(d)}${unit}` : 'N/A';

// ─── Search bar ───────────────────────────────────────────────────────────────
const SearchBar: React.FC<{ onSearch: (q: string) => void; loading: boolean; city: string }> = ({
  onSearch, loading, city,
}) => {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (val.trim().length >= 2) onSearch(val.trim());
  };
  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative flex items-center">
        <div className="absolute left-4 pointer-events-none text-gray-400">
          {loading
            ? <FiLoader size={17} className="animate-spin text-cyan-400" />
            : <FiSearch size={17} />}
        </div>
        <input
          ref={ref} value={val} onChange={e => setVal(e.target.value)}
          disabled={loading}
          placeholder="Search city, state or location…"
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-32
                     text-white placeholder-gray-500 text-sm focus:outline-none
                     focus:border-cyan-500/60 disabled:opacity-60 transition-all"
        />
        {city && !loading && (
          <div className="absolute right-24 flex items-center gap-1 text-xs text-cyan-400 pointer-events-none">
            <FiMapPin size={11} />
            <span className="truncate max-w-[100px]">{city}</span>
          </div>
        )}
        <button type="submit" disabled={loading || val.trim().length < 2}
          className="absolute right-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400
                     disabled:bg-cyan-500/30 text-black font-semibold text-xs rounded-lg transition-all">
          Search
        </button>
      </div>
    </form>
  );
};

// ─── Summary card ─────────────────────────────────────────────────────────────
const SummaryCard: React.FC<{
  title: string; value: string; sub: string;
  icon: React.ElementType; iconColor: string; badge?: string;
  to: string; tag?: string; tagColor?: string;
}> = ({ title, value, sub, icon: Icon, iconColor, badge, to, tag, tagColor }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
    className="glass-card p-5 flex flex-col gap-3 hover:border-white/20 transition-all group">
    <div className="flex items-start justify-between">
      <div className={`p-2.5 rounded-xl bg-white/5 ${iconColor}`}>
        <Icon size={20} />
      </div>
      {tag && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${tagColor}`}>
          {tag}
        </span>
      )}
    </div>
    <div>
      <p className={`text-3xl font-extrabold ${badge ?? 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-400 font-medium">{title}</p>
      <Link to={to}
        className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
        Details <FiArrowRight size={11} />
      </Link>
    </div>
  </motion.div>
);

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { data, loading, error, locationMode, searchLocation, searchLocationAuto, setAutoMode, clearError } = useLocCtx();
  const { user } = useAuth();
  const [initialDone, setInitialDone] = useState(false);

  useEffect(() => {
    // Only auto-init with Kolkata if user has NOT already manually chosen a location.
    // searchLocationAuto silently skips when mode === 'manual'.
    searchLocationAuto('Kolkata').then(() => setInitialDone(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const w   = data?.weather;
  const aqi = data?.aqi;
  const loc = data?.location;
  const { Icon: WIcon, color: wColor } = w ? wmoIcon(w.condition_code) : { Icon: FiCloud, color: 'text-gray-400' };
  const locLabel = loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') : '';

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Citizen Dashboard</h1>
          {loc ? (
            <div className="flex items-center gap-1.5 mt-1 text-sm">
              <FiMapPin size={13} className="text-cyan-400" />
              <span className="text-cyan-400 font-medium">{locLabel}</span>
            </div>
          ) : (
            <p className="text-gray-500 text-sm mt-1">Search a city to load live data</p>
          )}
        </div>
        {data && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Last Updated</p>
            <p className="text-cyan-400 text-sm font-medium flex items-center gap-1 justify-end">
              <FiRefreshCw size={11} /> {fmtTime(data.last_updated)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Lat {loc?.lat.toFixed(3)} · Lng {loc?.lng.toFixed(3)}
            </p>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className="glass-card p-4 space-y-2">
        <SearchBar onSearch={searchLocation} loading={loading} city={loc?.city ?? ''} />
        <div className="flex items-center justify-between pl-1">
          <p className="text-xs text-gray-600">Try: Kolkata · Delhi · Mumbai · Bengaluru · Chennai</p>
          {locationMode === 'manual' && (
            <button
              onClick={() => { setAutoMode(); searchLocationAuto('Kolkata'); }}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <FiMapPin size={11} /> Use Auto Location
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <FiAlertCircle size={15} className="shrink-0" />
            {error}
            <button onClick={clearError} className="ml-auto text-xs underline">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Initial loading ── */}
      {!initialDone && loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <FiLoader size={26} className="animate-spin text-cyan-400" />
          <span>Fetching live city data…</span>
        </div>
      )}

      {/* ── Content ── */}
      {data && (
        <AnimatePresence mode="wait">
          <motion.div key={locLabel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-6">

            {/* Welcome strip */}
            <div className="glass-card px-5 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Welcome back, <span className="text-white font-semibold">{user?.full_name || user?.username}</span>
              </p>
              <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                Citizen
              </span>
            </div>

            {/* ── 4 summary cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <SummaryCard
                title="Weather" to="/weather"
                value={fmt(w?.temp, '°C', 1)}
                sub={w?.condition ?? '—'}
                icon={WIcon} iconColor={wColor}
                tag="Live" tagColor="bg-green-500/10 text-green-400 border border-green-500/20"
              />
              <SummaryCard
                title="Air Quality" to="/air-quality"
                value={aqi?.aqi_us != null ? String(Math.round(aqi.aqi_us)) : 'N/A'}
                sub={aqi?.aqi_category ?? '—'}
                icon={FiWind} iconColor={aqiColor(aqi?.aqi_us ?? null)}
                badge={aqiColor(aqi?.aqi_us ?? null)}
                tag="Live" tagColor="bg-green-500/10 text-green-400 border border-green-500/20"
              />
              <SummaryCard
                title="Traffic" to="/traffic"
                value={data.traffic_status && data.traffic_status !== 'Source not connected'
                  ? data.traffic_status
                  : '—'}
                sub={data.traffic_status && data.traffic_status !== 'Source not connected'
                  ? `${loc?.city ?? ''} road conditions`
                  : 'No data available'}
                icon={FiTruck}
                iconColor={trafficColor(data.traffic_status ?? '')}
                badge={trafficColor(data.traffic_status ?? '')}
                tag={trafficTag(data.traffic_status ?? '').label}
                tagColor={trafficTag(data.traffic_status ?? '').color}
              />
              <SummaryCard
                title="Water / Flood" to="/water-flood"
                value="—"
                sub="Source not connected"
                icon={FiDroplet} iconColor="text-gray-500"
                tag="Unavailable" tagColor="bg-gray-500/10 text-gray-500 border border-gray-500/20"
              />
            </div>

            {/* ── Row 2: Weather strip + AQI strip ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Weather quick stats */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-white">Current Weather</h2>
                  <Link to="/weather" className="text-xs text-cyan-400 flex items-center gap-1 hover:opacity-80">
                    Full details <FiArrowRight size={11} />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Temperature',   val: fmt(w?.temp,        '°C', 1), icon: FiThermometer, color: 'text-yellow-400' },
                    { label: 'Humidity',       val: fmt(w?.humidity,    '%', 0),  icon: FiDroplet,     color: 'text-blue-400'   },
                    { label: 'Wind',           val: fmt(w?.wind_speed,  ' km/h', 1), icon: FiWind,    color: 'text-cyan-400'   },
                  ].map(({ label, val, icon: Ic, color }) => (
                    <div key={label} className="flex flex-col items-center gap-1 bg-white/5 rounded-xl p-3 text-center">
                      <Ic size={18} className={color} />
                      <p className="text-sm font-bold text-white">{val}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-3 text-right">
                  Source: Open-Meteo · Updated {fmtTime(w?.last_updated ?? '')}
                </p>
              </motion.div>

              {/* AQI quick stats */}
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-white">Air Quality</h2>
                  <Link to="/air-quality" className="text-xs text-cyan-400 flex items-center gap-1 hover:opacity-80">
                    Full details <FiArrowRight size={11} />
                  </Link>
                </div>
                <div className="flex items-center gap-5">
                  <div className={`text-5xl font-extrabold ${aqiColor(aqi?.aqi_us ?? null)}`}>
                    {aqi?.aqi_us != null ? Math.round(aqi.aqi_us) : 'N/A'}
                  </div>
                  <div>
                    <p className={`text-base font-bold ${aqiColor(aqi?.aqi_us ?? null)}`}>
                      {aqi?.aqi_category}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PM2.5: {aqi?.pm25 != null ? `${aqi.pm25.toFixed(1)} µg/m³` : 'N/A'}<br />
                      PM10:  {aqi?.pm10 != null ? `${aqi.pm10.toFixed(1)} µg/m³` : 'N/A'}
                    </p>
                  </div>
                </div>
                {aqi?.aqi_us != null && (
                  <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min((aqi.aqi_us / 300) * 100, 100)}%`,
                        background: aqi.aqi_us <= 50 ? '#4ade80'
                          : aqi.aqi_us <= 100 ? '#facc15'
                          : aqi.aqi_us <= 150 ? '#fb923c' : '#f87171',
                      }} />
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-3 text-right">
                  Source: Open-Meteo AQ · Updated {fmtTime(aqi?.last_updated ?? '')}
                </p>
              </motion.div>
            </div>

            {/* ── 7-day forecast mini ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }} className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">7-Day Forecast</h2>
                <Link to="/weather" className="text-xs text-cyan-400 flex items-center gap-1 hover:opacity-80">
                  Weather page <FiArrowRight size={11} />
                </Link>
              </div>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="grid grid-cols-7 gap-2 min-w-[420px]">
                {data.forecast.map((day, i) => {
                  const { Icon: DIcon, color: dc } = wmoIcon(day.condition_code);
                  return (
                    <div key={day.date}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center
                        ${i === 0 ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-white/5'}`}>
                      <p className={`text-xs font-bold ${i === 0 ? 'text-cyan-400' : 'text-white'}`}>
                        {day.day_name}
                      </p>
                      <DIcon size={18} className={dc} />
                      <p className="text-xs font-bold text-white">{day.high.toFixed(0)}°</p>
                      <p className="text-xs text-gray-500">{day.low.toFixed(0)}°</p>
                    </div>
                  );
                })}
                </div>
              </div>
            </motion.div>

            {/* ── Services quick links ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }} className="glass-card p-5">
              <h2 className="font-semibold text-white mb-4">City Services</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { to: '/air-quality', label: 'Air Quality',    icon: FiWind,    color: 'text-green-400',  bg: 'bg-green-500/10'  },
                  { to: '/weather',     label: 'Weather',        icon: FiCloud,   color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
                  { to: '/traffic',     label: 'Traffic',        icon: FiTruck,   color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { to: '/water-flood', label: 'Water / Flood',  icon: FiDroplet, color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
                  { to: '/complaints',  label: 'Complaints',     icon: FiSearch,  color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { to: '/emergency',   label: 'Emergency',      icon: FiAlertCircle, color: 'text-red-400',bg: 'bg-red-500/10'    },
                  { to: '/map',         label: 'City Map',       icon: FiMapPin,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { to: '/profile',     label: 'My Profile',     icon: FiRefreshCw, color: 'text-gray-400', bg: 'bg-gray-500/10'  },
                ].map(({ to, label, icon: Ic, color, bg }) => (
                  <Link key={to} to={to}
                    className={`flex items-center gap-3 p-3 rounded-xl ${bg} border border-white/5
                                hover:border-white/15 transition-all group`}>
                    <Ic size={16} className={color} />
                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default Dashboard;
