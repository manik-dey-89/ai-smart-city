import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWind, FiMapPin, FiRefreshCw, FiAlertCircle, FiLoader, FiHeart, FiSearch } from 'react-icons/fi';
import { useLocation as useLocCtx } from '../contexts/LocationContext';

const fmt = (v: number | null | undefined, unit = '', d = 1) =>
  v != null ? `${v.toFixed(d)}${unit}` : 'N/A';

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function aqiColor(v: number | null) {
  if (v == null) return 'text-gray-400';
  if (v <= 50)   return 'text-green-400';
  if (v <= 100)  return 'text-yellow-400';
  if (v <= 150)  return 'text-orange-400';
  if (v <= 200)  return 'text-red-400';
  return 'text-purple-400';
}

interface HealthRec { icon: string; title: string; items: string[] }
function healthRec(category: string): HealthRec {
  switch (category) {
    case 'Good':
      return { icon: '😊', title: 'Air quality is satisfactory',
        items: ['Outdoor activities are safe for all', 'No special precautions needed', 'Ideal for exercise outdoors'] };
    case 'Moderate':
      return { icon: '😐', title: 'Air quality is acceptable',
        items: ['Unusually sensitive people should reduce prolonged outdoor exertion',
                'Most people are not at risk', 'Consider limiting extended outdoor exercise if sensitive'] };
    case 'Unhealthy for Sensitive Groups':
      return { icon: '😷', title: 'Sensitive groups may experience issues',
        items: ['People with respiratory or heart conditions should reduce outdoor activity',
                'Children and elderly should take extra care',
                'Keep windows closed during peak pollution hours'] };
    case 'Unhealthy':
      return { icon: '⚠️', title: 'Health effects possible for everyone',
        items: ['Avoid prolonged outdoor physical activity', 'Wear a mask if going outside',
                'Keep indoor air clean with ventilation'] };
    case 'Very Unhealthy':
      return { icon: '🚨', title: 'Health alert — avoid outdoor activity',
        items: ['Everyone should avoid outdoor activities', 'Stay indoors with windows closed',
                'Use air purifiers if available', 'Seek medical advice if symptoms develop'] };
    case 'Hazardous':
      return { icon: '☣️', title: 'Emergency conditions',
        items: ['Everyone must avoid all outdoor activity', 'Seal gaps in windows and doors',
                'Wear N95 mask if going out is unavoidable', 'Consult a doctor immediately if experiencing symptoms'] };
    default:
      return { icon: '❓', title: 'Data unavailable',
        items: ['Air quality data is currently unavailable for this location',
                'Please check back later or try a different location'] };
  }
}

// Simple bar
const SimplePollBar: React.FC<{
  label: string; value: number | null; unit: string;
  max: number; barColor: string; txtColor: string; description?: string;
}> = ({ label, value, unit, max, barColor, txtColor, description }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-semibold text-white">{label}</span>
        {description && <span className="text-xs text-gray-600 ml-2">{description}</span>}
      </div>
      <span className={`text-sm font-bold ${value != null ? txtColor : 'text-gray-500'}`}>
        {fmt(value, ` ${unit}`, 1)}
      </span>
    </div>
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: value != null ? `${Math.min((value / max) * 100, 100)}%` : '0%', background: barColor }} />
    </div>
  </div>
);

const AirQuality: React.FC = () => {
  const { data, loading, error, searchLocation } = useLocCtx();
  const [searchVal, setSearchVal] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim().length >= 2) searchLocation(searchVal.trim());
  };

  const aqi  = data?.aqi;
  const loc  = data?.location;
  const locLabel = loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') : '';
  const rec  = healthRec(aqi?.aqi_category ?? '');
  const isUnavailable = aqi?.aqi_category?.includes('unavailable') ||
                        aqi?.aqi_category?.includes('N/A') || !aqi;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Air Quality</h1>
          <div className="flex items-center gap-1.5 mt-1 text-sm">
            <FiMapPin size={13} className="text-cyan-400" />
            <span className="text-cyan-400 font-medium">{locLabel || 'Search a city below'}</span>
          </div>
        </div>
        {aqi && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-600">Last Updated</p>
            <p className="text-cyan-400 text-sm font-medium flex items-center gap-1 justify-end">
              <FiRefreshCw size={11} /> {fmtTime(aqi.last_updated)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">Source: Open-Meteo AQ</p>
          </div>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="glass-card p-4">
        <div className="relative flex items-center gap-3">
          <div className="relative flex-1">
            {loading
              ? <FiLoader size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-cyan-400" />
              : <FiSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />}
            <input
              ref={searchRef}
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search city for air quality data… e.g. Mumbai, Delhi, Chennai"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm
                         placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
          <button type="submit" disabled={loading || searchVal.trim().length < 2}
            className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/30
                       text-black font-bold text-sm rounded-xl transition-all">
            Search
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2 pl-1">Try: Kolkata · Delhi · Mumbai · Bengaluru · Chennai · Hyderabad</p>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <FiLoader size={24} className="animate-spin text-cyan-400" />
          <span>Fetching air quality data…</span>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <FiAlertCircle size={15} className="shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No data prompt */}
      {!data && !loading && !error && (
        <div className="glass-card p-10 text-center text-gray-500">
          <FiWind size={36} className="mx-auto mb-3 text-gray-600" />
          <p className="font-medium text-white">Search a city to see live air quality data</p>
          <p className="text-sm mt-1">Enter any Indian or global city in the search box above.</p>
        </div>
      )}

      {data && (
        <AnimatePresence mode="wait">
          <motion.div key={locLabel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-6">

            {/* AQI hero */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Big AQI number */}
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-6 flex flex-col items-center justify-center text-center gap-2">
                <FiWind size={28} className={aqiColor(aqi?.aqi_us ?? null)} />
                <p className={`text-7xl font-extrabold ${aqiColor(aqi?.aqi_us ?? null)}`}>
                  {aqi?.aqi_us != null ? Math.round(aqi.aqi_us) : 'N/A'}
                </p>
                <p className={`text-lg font-bold ${aqiColor(aqi?.aqi_us ?? null)}`}>
                  {isUnavailable ? 'Data Unavailable' : aqi?.aqi_category}
                </p>
                <p className="text-xs text-gray-500">US AQI (EPA formula from PM2.5)</p>
                {aqi?.aqi_us != null && (
                  <div className="w-full mt-2">
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((aqi.aqi_us / 300) * 100, 100)}%`,
                          background: aqi.aqi_us <= 50  ? '#4ade80'
                            : aqi.aqi_us <= 100 ? '#facc15'
                            : aqi.aqi_us <= 150 ? '#fb923c' : '#f87171',
                        }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>0</span><span>100</span><span>200</span><span>300+</span>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Health recommendation */}
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2 glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FiHeart size={18} className="text-pink-400" />
                  <h2 className="font-semibold text-white">Health Recommendation</h2>
                  <span className="text-xs text-gray-600 ml-auto">Not a medical diagnosis</span>
                </div>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{rec.icon}</span>
                  <p className="text-base font-semibold text-white">{rec.title}</p>
                </div>
                <ul className="space-y-2">
                  {rec.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-cyan-400 mt-0.5">•</span> {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Pollutants grid */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }} className="glass-card p-6">
              <h2 className="font-semibold text-white mb-5">Pollutant Levels</h2>

              {isUnavailable ? (
                <p className="text-gray-500 italic text-sm py-4 text-center">
                  Air quality data temporarily unavailable for this location.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  <SimplePollBar label="PM2.5"  value={aqi?.pm25 ?? null} unit="µg/m³" max={150}  barColor="#fb923c" txtColor="text-orange-400" description="Fine particles" />
                  <SimplePollBar label="PM10"   value={aqi?.pm10 ?? null} unit="µg/m³" max={250}  barColor="#facc15" txtColor="text-yellow-400" description="Coarse particles" />
                  <SimplePollBar label="NO₂"    value={aqi?.no2  ?? null} unit="µg/m³" max={200}  barColor="#a855f7" txtColor="text-purple-400" description="Nitrogen dioxide" />
                  <SimplePollBar label="O₃"     value={aqi?.o3   ?? null} unit="µg/m³" max={180}  barColor="#06b6d4" txtColor="text-cyan-400"   description="Ozone" />
                  <SimplePollBar label="CO"      value={aqi?.co   ?? null} unit="µg/m³" max={10000} barColor="#f87171" txtColor="text-red-400"    description="Carbon monoxide" />
                  <SimplePollBar label="SO₂"    value={aqi?.so2  ?? null} unit="µg/m³" max={350}  barColor="#f472b6" txtColor="text-pink-400"   description="Sulphur dioxide" />
                </div>
              )}
            </motion.div>

            {/* Raw values table */}
            {!isUnavailable && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }} className="glass-card p-6">
                <h2 className="font-semibold text-white mb-4">Current Readings</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'AQI',   value: aqi?.aqi_us != null ? String(Math.round(aqi.aqi_us)) : 'N/A', color: aqiColor(aqi?.aqi_us ?? null) },
                    { label: 'PM2.5', value: fmt(aqi?.pm25, ' µg/m³'), color: 'text-orange-400' },
                    { label: 'PM10',  value: fmt(aqi?.pm10, ' µg/m³'), color: 'text-yellow-400' },
                    { label: 'NO₂',   value: fmt(aqi?.no2,  ' µg/m³'), color: 'text-purple-400' },
                    { label: 'O₃',    value: fmt(aqi?.o3,   ' µg/m³'), color: 'text-cyan-400'   },
                    { label: 'CO',    value: fmt(aqi?.co,   ' µg/m³'), color: 'text-red-400'    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className={`text-sm font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-4 text-right">
                  Source: Open-Meteo Air Quality API (open-meteo.com) · Updated {fmtTime(aqi?.last_updated ?? '')}
                </p>
              </motion.div>
            )}

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default AirQuality;
