import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSun, FiCloud, FiCloudRain, FiCloudLightning, FiCloudSnow,
  FiDroplet, FiWind, FiThermometer, FiMapPin, FiRefreshCw,
  FiAlertCircle, FiLoader, FiSearch,
} from 'react-icons/fi';
import { useLocation as useLocCtx } from '../contexts/LocationContext';

const fmt = (v: number | null | undefined, unit = '', d = 1) =>
  v != null ? `${v.toFixed(d)}${unit}` : 'N/A';

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function wmoIcon(code: number): { Icon: React.ElementType; color: string } {
  if (code === 0 || code === 1) return { Icon: FiSun,            color: 'text-yellow-400' };
  if (code <= 3)                return { Icon: FiCloud,           color: 'text-gray-300'   };
  if (code <= 48)               return { Icon: FiCloud,           color: 'text-gray-400'   };
  if (code <= 67)               return { Icon: FiCloudRain,       color: 'text-cyan-400'   };
  if (code <= 77)               return { Icon: FiCloudSnow,       color: 'text-blue-200'   };
  if (code <= 82)               return { Icon: FiCloudRain,       color: 'text-blue-400'   };
  return { Icon: FiCloudLightning, color: 'text-orange-400' };
}

const Weather: React.FC = () => {
  const { data, loading, error, searchLocation } = useLocCtx();
  const [searchVal, setSearchVal] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim().length >= 2) searchLocation(searchVal.trim());
  };
  const w   = data?.weather;
  const loc = data?.location;
  const locLabel = loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') : '';
  const { Icon: WIcon, color: wColor } = w ? wmoIcon(w.condition_code) : { Icon: FiCloud, color: 'text-gray-400' };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Weather</h1>
          <div className="flex items-center gap-1.5 mt-1 text-sm">
            <FiMapPin size={13} className="text-cyan-400" />
            <span className="text-cyan-400 font-medium">{locLabel || 'Search a city below'}</span>
          </div>
        </div>
        {w && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-600">Last Updated</p>
            <p className="text-cyan-400 text-sm font-medium flex items-center gap-1 justify-end">
              <FiRefreshCw size={11} /> {fmtTime(w.last_updated)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">Source: Open-Meteo</p>
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
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search city for weather… e.g. Delhi, Mumbai, Bengaluru"
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
        <p className="text-xs text-gray-600 mt-2 pl-1">Try: Kolkata · Delhi · Mumbai · Bengaluru · Chennai</p>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <FiLoader size={24} className="animate-spin text-cyan-400" />
          <span>Fetching weather data…</span>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <FiAlertCircle size={15} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {!data && !loading && !error && (
        <div className="glass-card p-10 text-center text-gray-500">
          <FiCloud size={36} className="mx-auto mb-3 text-gray-600" />
          <p className="font-medium text-white">Search a city to see live weather data</p>
          <p className="text-sm mt-1">Enter any city in the search box above.</p>
        </div>
      )}

      {data && w && (
        <AnimatePresence mode="wait">
          <motion.div key={locLabel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-6">

            {/* Current weather hero */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-5">
                  <WIcon size={64} className={wColor} />
                  <div>
                    <p className="text-6xl font-extrabold text-white">{fmt(w.temp, '°C', 1)}</p>
                    <p className="text-xl text-gray-300 mt-1">{w.condition}</p>
                    <p className="text-sm text-gray-500 mt-1">Feels like {fmt(w.feels_like, '°C', 1)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { icon: FiDroplet,     color: 'text-blue-400',   label: 'Humidity',       val: fmt(w.humidity,     '%', 0)    },
                    { icon: FiWind,        color: 'text-cyan-400',   label: 'Wind Speed',     val: fmt(w.wind_speed,   ' km/h', 1) },
                    { icon: FiCloudRain,   color: 'text-indigo-400', label: 'Precipitation',  val: fmt(w.precipitation,' mm', 1)  },
                    { icon: FiThermometer, color: 'text-orange-400', label: 'Feels Like',     val: fmt(w.feels_like,   '°C', 1)   },
                  ].map(({ icon: Ic, color, label, val }) => (
                    <div key={label} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                      <Ic size={15} className={color} />
                      <div>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="font-semibold text-white">{val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Detailed stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Temperature',  val: fmt(w.temp,        '°C', 1),    icon: FiThermometer, color: 'text-yellow-400' },
                { label: 'Feels Like',   val: fmt(w.feels_like,  '°C', 1),    icon: FiThermometer, color: 'text-orange-400' },
                { label: 'Humidity',     val: fmt(w.humidity,    '%', 0),      icon: FiDroplet,     color: 'text-blue-400'   },
                { label: 'Wind',         val: fmt(w.wind_speed,  ' km/h', 1), icon: FiWind,        color: 'text-cyan-400'   },
                { label: 'Precipitation',val: fmt(w.precipitation,' mm', 1),  icon: FiCloudRain,   color: 'text-indigo-400' },
                { label: 'Condition',    val: w.condition,                     icon: FiCloud,       color: 'text-gray-300'   },
              ].map(({ label, val, icon: Ic, color }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }} className="glass-card p-4 text-center">
                  <Ic size={20} className={`${color} mx-auto mb-2`} />
                  <p className="text-sm font-bold text-white">{val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </motion.div>
              ))}
            </div>

            {/* 7-day forecast */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }} className="glass-card p-6">
              <h2 className="font-semibold text-white mb-5">7-Day Forecast</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {data.forecast.map((day, i) => {
                  const { Icon: DIcon, color: dc } = wmoIcon(day.condition_code);
                  return (
                    <motion.div key={day.date}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl text-center
                        ${i === 0 ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-white/5'}`}>
                      <p className="text-xs text-gray-500">
                        {day.date.slice(5).replace('-', '/')}
                      </p>
                      <p className={`text-xs font-bold ${i === 0 ? 'text-cyan-400' : 'text-white'}`}>
                        {day.day_name}
                      </p>
                      <DIcon size={24} className={dc} />
                      <p className="text-xs text-gray-400 leading-tight">{day.condition}</p>
                      <div className="flex gap-2 text-xs">
                        <span className="font-bold text-white">{day.high.toFixed(0)}°</span>
                        <span className="text-gray-500">{day.low.toFixed(0)}°</span>
                      </div>
                      {day.precipitation_sum > 0 && (
                        <p className="text-xs text-blue-400">{day.precipitation_sum.toFixed(1)} mm</p>
                      )}
                      {day.wind_max > 0 && (
                        <p className="text-xs text-gray-600">{day.wind_max.toFixed(0)} km/h</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-4 text-right">
                Source: Open-Meteo (open-meteo.com) · Forecast data · Updated {fmtTime(w.last_updated)}
              </p>
            </motion.div>

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default Weather;
