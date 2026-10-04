import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDroplet, FiMapPin, FiRefreshCw, FiAlertCircle, FiLoader, FiExternalLink,
} from 'react-icons/fi';
import { useLocation as useLocCtx, ForecastDay } from '../contexts/LocationContext';

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// Derive a simple flood risk level from 7-day total precipitation
function floodRisk(forecastDays: ForecastDay[]): {
  level: string; color: string; bg: string; description: string; total7d: number;
} {
  const total = forecastDays.reduce((s, d) => s + (d.precipitation_sum ?? 0), 0);
  if (total >= 150) return {
    level: 'SEVERE', color: 'text-purple-400', bg: 'bg-purple-500/10',
    description: 'Very heavy cumulative rainfall forecast. High flood risk in low-lying areas.',
    total7d: total,
  };
  if (total >= 80) return {
    level: 'HIGH', color: 'text-red-400', bg: 'bg-red-500/10',
    description: 'Significant rainfall expected over next 7 days. Possible localised flooding.',
    total7d: total,
  };
  if (total >= 30) return {
    level: 'MODERATE', color: 'text-orange-400', bg: 'bg-orange-500/10',
    description: 'Moderate rainfall forecast. Stay alert, especially near rivers and drainage areas.',
    total7d: total,
  };
  return {
    level: 'LOW', color: 'text-green-400', bg: 'bg-green-500/10',
    description: 'Low rainfall expected. No significant flood risk at this time.',
    total7d: total,
  };
}

const WaterFlood: React.FC = () => {
  const { data, loading, error } = useLocCtx();
  const loc = data?.location;
  const locLabel = loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') : '';
  const forecast = data?.forecast ?? [];
  const weather  = data?.weather;

  const risk = data ? floodRisk(forecast) : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Water / Flood</h1>
          <div className="flex items-center gap-1.5 mt-1 text-sm">
            <FiMapPin size={13} className="text-cyan-400" />
            <span className="text-cyan-400 font-medium">{locLabel || 'Search a city on Dashboard'}</span>
          </div>
        </div>
        {weather && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-600">Last Updated</p>
            <p className="text-cyan-400 text-sm font-medium flex items-center gap-1 justify-end">
              <FiRefreshCw size={11} /> {fmtTime(weather.last_updated)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">Precipitation: Open-Meteo (Forecast)</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <FiLoader size={24} className="animate-spin text-cyan-400" />
          <span>Fetching rainfall data…</span>
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
          <FiDroplet size={36} className="mx-auto mb-3 text-gray-600" />
          <p>Go to Dashboard and search a city to load water / flood data.</p>
        </div>
      )}

      {data && risk && (
        <AnimatePresence mode="wait">
          <motion.div key={locLabel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-6">

            {/* Disclaimer */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300">
              <FiAlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                Flood risk shown here is <strong>derived from 7-day precipitation forecast only</strong> (Open-Meteo).
                It does not include river gauge data, soil saturation or terrain analysis.
                For official flood warnings visit your national meteorological service.
              </span>
            </div>

            {/* Risk hero */}
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className={`glass-card p-6 border ${risk.bg.replace('bg-', 'border-').replace('/10', '/20')}`}>
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${risk.bg}`}>
                  <FiDroplet size={36} className={risk.color} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                    7-Day Flood Risk — Forecast
                  </p>
                  <p className={`text-4xl font-extrabold ${risk.color}`}>{risk.level}</p>
                  <p className="text-sm text-gray-400 mt-2 max-w-md">{risk.description}</p>
                </div>
                <div className="ml-auto text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-gray-500">7-Day Total Precip</p>
                  <p className={`text-3xl font-extrabold ${risk.color}`}>
                    {risk.total7d.toFixed(1)}
                    <span className="text-base font-normal text-gray-500 ml-1">mm</span>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Current precipitation + today's data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Now — Precipitation',  val: `${(weather?.precipitation ?? 0).toFixed(1)} mm`, color: 'text-blue-400',  bg: 'bg-blue-500/10',   tag: 'LIVE' },
                { label: 'Today — Forecast',     val: forecast[0] ? `${forecast[0].precipitation_sum.toFixed(1)} mm` : 'N/A', color: 'text-cyan-400',  bg: 'bg-cyan-500/10',  tag: 'FORECAST' },
                { label: '7-Day Total Forecast', val: `${risk.total7d.toFixed(1)} mm`,             color: risk.color, bg: risk.bg, tag: 'FORECAST' },
              ].map(({ label, val, color, bg, tag }) => (
                <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`glass-card p-5 ${bg}`}>
                  <div className="flex items-start justify-between mb-2">
                    <FiDroplet size={18} className={color} />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tag === 'LIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>{tag}</span>
                  </div>
                  <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </motion.div>
              ))}
            </div>

            {/* Daily precipitation forecast */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }} className="glass-card p-6">
              <h2 className="font-semibold text-white mb-4">Daily Rainfall Forecast</h2>
              <div className="space-y-3">
                {forecast.map((day, i) => {
                  const maxPrecip = Math.max(...forecast.map(d => d.precipitation_sum), 1);
                  const pct = (day.precipitation_sum / maxPrecip) * 100;
                  return (
                    <div key={day.date} className="grid grid-cols-[80px_1fr_60px] items-center gap-3">
                      <div>
                        <p className={`text-xs font-bold ${i === 0 ? 'text-cyan-400' : 'text-white'}`}>
                          {day.day_name}
                        </p>
                        <p className="text-xs text-gray-600">{day.date.slice(5).replace('-', '/')}</p>
                      </div>
                      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.05 * i, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: day.precipitation_sum > 20 ? '#f87171' : day.precipitation_sum > 5 ? '#60a5fa' : '#06b6d4' }}
                        />
                      </div>
                      <p className="text-right text-xs font-semibold text-white">
                        {day.precipitation_sum.toFixed(1)} mm
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-4 text-right">
                Source: Open-Meteo (Forecast) · Not official flood warning data
              </p>
            </motion.div>

            {/* Live river data unavailable */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }} className="glass-card p-5 border border-white/5">
              <h3 className="text-sm font-semibold text-white mb-2">River / Hydrological Data</h3>
              <p className="text-sm text-gray-500 mb-3">
                Live river gauge, discharge and water-level data requires integration with a
                hydrological data provider (e.g.{' '}
                <strong className="text-white">Copernicus GloFAS / CEMS</strong>).
                This data is not currently connected.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                {['River Discharge', 'Flood Extent Forecast', 'Soil Moisture', 'Return Period'].map(f => (
                  <span key={f} className="bg-gray-500/10 border border-gray-500/20 px-3 py-1.5 rounded-lg text-gray-500">
                    {f} — Unavailable
                  </span>
                ))}
                <a href="https://global-flood.emergency.copernicus.eu/" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg text-blue-400 hover:opacity-80 transition-opacity">
                  GloFAS Portal <FiExternalLink size={11} />
                </a>
              </div>
            </motion.div>

          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default WaterFlood;
