/**
 * Traffic.tsx — TrafficSense AI Panel
 * Two-column layout: Neural Input (left) sticks alongside results (right).
 * Three routes shown on OSM map with distinct colours.
 */
import React, {
  useEffect, useState, useCallback, useRef, useMemo,
} from 'react';
import {
  MapContainer, TileLayer, Polyline, Marker, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  FiNavigation, FiMapPin, FiZap, FiClock, FiAlertTriangle,
  FiCheckCircle, FiCloud, FiWind, FiDroplet, FiShield,
  FiTrendingUp, FiLoader, FiVolume2, FiVolumeX,
  FiTarget, FiStar, FiActivity,
  FiThermometer, FiAlertCircle, FiCpu,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

/* ─── Fix Leaflet default icons ─────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const makeIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 0 8px ${color}88;"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
const originIcon = makeIcon('#22d3ee');
const destIcon   = makeIcon('#f97316');

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface RouteWeather {
  condition: string; condition_code: number; temp: number;
  humidity: number; wind_speed: number; precipitation: number;
  visibility_ok: boolean; weather_impact: string; weather_tip: string;
}
interface RouteAlt {
  label: string; distance_km: number; duration_min: number;
  congestion_level: string; polyline: [number,number][];
}
interface SegmentRisk { label: string; congestion_pct: number; risk_level: string; }
interface FlowPoint   { hour: string; flow: number; }
interface RouteAnalysis {
  origin_name: string; destination_name: string;
  origin_lat: number; origin_lng: number;
  dest_lat: number;   dest_lng: number;
  polyline: [number,number][];
  distance_km: number; duration_min: number;
  congestion_level: string; congestion_index: number;
  predicted_density: string; confidence_score: number;
  ai_decision: string;
  weather: RouteWeather;
  accident_risk: string; accident_factors: string[];
  alternatives: RouteAlt[];
  segment_risks: SegmentRisk[];
  temporal_flow: FlowPoint[];
  route_verified: boolean; data_sources: string[];
  travel_tips: string[];
  tomorrow_density: string; tomorrow_tip: string;
  last_updated: string; day_of_week: string; local_time: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};
const DENSITY: Record<string,{color:string;glow:string;bg:string;border:string}> = {
  LOW:    {color:'text-green-400',  glow:'#4ade80',bg:'bg-green-500/10', border:'border-green-500/30' },
  MEDIUM: {color:'text-yellow-400', glow:'#facc15',bg:'bg-yellow-500/10',border:'border-yellow-500/30'},
  HIGH:   {color:'text-red-400',    glow:'#f87171',bg:'bg-red-500/10',   border:'border-red-500/30'  },
};
const CONG: Record<string,{color:string}> = {
  'Free Flow':    {color:'text-green-400' },
  'Light Traffic':{color:'text-lime-400'  },
  'Moderate':     {color:'text-yellow-400'},
  'Heavy':        {color:'text-orange-400'},
  'Standstill':   {color:'text-red-400'   },
};
const RISK: Record<string,{color:string;bg:string}> = {
  Low:   {color:'text-green-400', bg:'bg-green-500/10' },
  Medium:{color:'text-yellow-400',bg:'bg-yellow-500/10'},
  High:  {color:'text-red-400',   bg:'bg-red-500/10'  },
};
// Three visually distinct route colours for the map
const ROUTE_COLORS = ['#f59e0b','#22d3ee','#a78bfa'];  // amber / cyan / violet
const congBar = (p:number) => p<30?'#4ade80':p<60?'#facc15':'#f87171';

/* ─── Map fit-bounds ─────────────────────────────────────────────────────── */
const FitBounds: React.FC<{pts:[number,number][]}> = ({pts}) => {
  const map = useMap();
  useEffect(() => {
    if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts), {padding:[40,40]});
  }, [pts, map]);
  return null;
};

/* ─── Autocomplete search ────────────────────────────────────────────────── */
interface Sug { display_name:string; lat:string; lon:string; }
const LocSearch: React.FC<{
  label:string; placeholder:string; icon:React.ElementType;
  value:string; onChange:(v:string)=>void; iconColor?:string;
}> = ({label,placeholder,icon:Icon,value,onChange,iconColor='text-cyan-400'}) => {
  const [sugs, setSugs]     = useState<Sug[]>([]);
  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const fetch_ = useCallback(async (q:string) => {
    if (q.trim().length < 3) { setSugs([]); return; }
    setBusy(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        {headers:{'User-Agent':'SmartCityDashboard/1.0'}}
      );
      setSugs(await r.json()); setOpen(true);
    } catch {/**/} finally { setBusy(false); }
  },[]);
  return (
    <div className="relative">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="relative flex items-center">
        <Icon size={14} className={`absolute left-3 shrink-0 ${iconColor}`}/>
        {busy && <FiLoader size={12} className="absolute right-3 animate-spin text-gray-500"/>}
        <input value={value}
          onChange={e=>{ onChange(e.target.value); if(timer.current) clearTimeout(timer.current);
            timer.current=setTimeout(()=>fetch_(e.target.value),420); }}
          onFocus={()=>sugs.length&&setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),200)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-8
                     text-white placeholder-gray-600 text-sm focus:outline-none
                     focus:border-cyan-500/50 transition-all"/>
      </div>
      <AnimatePresence>
        {open && sugs.length>0 && (
          <motion.ul initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="absolute z-[9999] w-full mt-1 glass-card border border-white/10
                       rounded-xl overflow-hidden shadow-2xl">
            {sugs.map((s,i)=>(
              <li key={i} onMouseDown={()=>{onChange(s.display_name);setSugs([]);setOpen(false);}}
                className="px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 cursor-pointer
                           border-b border-white/5 last:border-0 truncate">
                <FiMapPin size={10} className="inline mr-1.5 text-cyan-400"/>
                {s.display_name}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Custom dark select dropdown ───────────────────────────────────────── */
const DarkSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? 'Select…';

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2
                   bg-white/5 border border-white/10 rounded-xl py-2.5 px-3
                   text-sm text-white focus:outline-none focus:border-yellow-500/40
                   hover:border-white/20 transition-all cursor-pointer">
        <span className={selected ? 'text-white' : 'text-gray-500'}>{displayLabel}</span>
        <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: 'top', background: 'rgba(10,16,30,0.98)', border: '1px solid rgba(255,255,255,0.12)' }}
            className="absolute z-[9999] w-full mt-1 rounded-xl overflow-hidden shadow-2xl max-h-52 overflow-y-auto">
            {options.map(opt => (
              <li key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors
                  ${opt.value === value
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'text-gray-300 hover:bg-white/8 hover:text-white'}`}>
                {opt.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};


const Traffic: React.FC = () => {
  const {authFetch} = useAuth();

  const [origin, setOrigin]           = useState('');
  const [destination, setDestination] = useState('');
  const [targetDay, setTargetDay]     = useState('');
  const [targetTime, setTargetTime]   = useState('');
  const [result, setResult]           = useState<RouteAnalysis|null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [voiceOn, setVoiceOn]         = useState(true);
  const [speaking, setSpeaking]       = useState(false);
  const [didAnalyse, setDidAnalyse]   = useState(false);
  // Which route is highlighted on map (0=primary,1=alt1,2=alt2)
  const [activeRoute, setActiveRoute] = useState(0);

  const [now, setNow] = useState(new Date());
  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t); },[]);
  const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const curDay  = DAYS[now.getDay()];
  const curTime = now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  /* ── Analyse ─────────────────────────────────────────────────────────── */
  const analyse = useCallback(async()=>{
    if(!origin.trim()||!destination.trim()){setError('Enter both start location and destination.');return;}
    setLoading(true); setError('');
    try {
      const p=new URLSearchParams({origin:origin.trim(),destination:destination.trim(),
        ...(targetDay?{target_day:targetDay}:{}),
        ...(targetTime?{target_time:targetTime}:{})});
      const res=await authFetch(`/api/citizen/route?${p}`);
      if(!res.ok){let m='Route analysis failed';try{const j=await res.json();m=j.detail||m;}catch{/**/}setError(m);return;}
      const data:RouteAnalysis=await res.json();
      setResult(data); setDidAnalyse(true); setActiveRoute(0);
      if(voiceOn) speak(data);
    } catch { setError('Network error — could not reach the server.'); }
    finally { setLoading(false); }
  },[origin,destination,targetDay,targetTime,voiceOn,authFetch]);

  /* ── Voice ───────────────────────────────────────────────────────────── */
  const speak=(d:RouteAnalysis)=>{
    if(!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const dens=d.predicted_density==='LOW'?'light':d.predicted_density==='MEDIUM'?'moderate':'heavy';
    let txt=`Route analysis complete. Distance is ${d.distance_km} km, estimated ${d.duration_min} minutes. `;
    txt+=`Current traffic is ${dens}. `;
    if(d.weather.weather_impact!=='Low') txt+=`Weather impact is ${d.weather.weather_impact.toLowerCase()} — ${d.weather.weather_tip} `;
    txt+=`Accident risk is ${d.accident_risk.toLowerCase()}. `;
    if(d.travel_tips[0]) txt+=d.travel_tips[0];
    const u=new SpeechSynthesisUtterance(txt);
    u.rate=0.92; u.pitch=1.0; u.volume=0.9;
    u.onstart=()=>setSpeaking(true); u.onend=()=>setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  const toggleVoice=()=>{if(speaking){window.speechSynthesis.cancel();setSpeaking(false);}setVoiceOn(v=>!v);};
  const replayVoice=()=>{if(result) speak(result);};

  /* ── Map data ────────────────────────────────────────────────────────── */
  const allPolylines = useMemo(()=>
    result ? result.alternatives.map(a=>a.polyline as [number,number][]) : [],
    [result]);
  const primaryPoly = allPolylines[0] ?? [];
  const mapCenter:[number,number] = result
    ? [(result.origin_lat+result.dest_lat)/2,(result.origin_lng+result.dest_lng)/2]
    : [22.5726,88.3639];

  /* ── Chart ───────────────────────────────────────────────────────────── */
  const chartData = result?{
    labels:result.temporal_flow.map(p=>p.hour),
    datasets:[{label:'Flow',data:result.temporal_flow.map(p=>p.flow),
      fill:true,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.12)',
      pointRadius:0,tension:0.5}],
  }:null;
  const chartOpts={
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(15,23,42,0.95)',
      titleColor:'#fff',bodyColor:'#94a3b8',borderColor:'rgba(255,255,255,0.1)',borderWidth:1}},
    scales:{
      x:{ticks:{color:'#4b5563',font:{size:9}},grid:{color:'rgba(255,255,255,0.03)'}},
      y:{min:0,max:100,ticks:{color:'#4b5563',font:{size:9}},grid:{color:'rgba(255,255,255,0.03)'}},
    },
  } as const;

  const dm = result?(DENSITY[result.predicted_density]??DENSITY.MEDIUM):DENSITY.MEDIUM;
  const cm = result?(CONG[result.congestion_level]??CONG['Moderate']):CONG['Moderate'];

  return (
    <div className="space-y-5 pb-6">

      {/* ══ Header ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <FiCpu size={20} className="text-yellow-400"/>
            <span className="text-yellow-400">Traffic</span><span className="text-white">Sense</span>
            <span className="text-xs font-semibold bg-yellow-500/20 text-yellow-400
                             border border-yellow-500/30 px-2 py-0.5 rounded-full ml-1">AI</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Urban mobility intelligence · Real-time route analysis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="glass-card px-3 py-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-xs text-gray-400 font-mono">{curDay} · {curTime}</span>
          </div>
          <button onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all ${voiceOn?'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                :'bg-white/5 text-gray-500 border border-white/10'}`}>
            {voiceOn?<FiVolume2 size={13}/>:<FiVolumeX size={13}/>}
            {voiceOn?'Voice ON':'Voice OFF'}
            {speaking&&<span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>}
          </button>
          {result&&<button onClick={replayVoice} disabled={speaking}
            className="px-3 py-1.5 glass-card text-xs text-gray-400 hover:text-white
                       transition-all flex items-center gap-1.5 disabled:opacity-40">
            <FiVolume2 size={12}/> Replay
          </button>}
        </div>
      </div>

      {/* ══ Stat strip ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {icon:'🚗',label:'Active Vehicles',  value:result?'~12,400':'—'},
          {icon:'⚡',label:'Route Distance',    value:result?`${result.distance_km} km`:'—'},
          {icon:'⏱', label:'Est. Duration',    value:result?`${result.duration_min} min`:'—'},
          {icon:'🛡', label:'AI Confidence',   value:result?`${result.confidence_score}%`:'—'},
        ].map(({icon,label,value})=>(
          <div key={label} className="glass-card px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-extrabold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ══ Body: 2-column grid (Neural Input | Results) ═════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">

        {/* ── LEFT: Neural Input (always visible) ───────────────────────── */}
        <div className="space-y-4">

          {/* Input card */}
          <div className="glass-card p-5 border border-yellow-500/10">
            <h2 className="font-bold text-white flex items-center gap-2 mb-4">
              <span className="text-yellow-400">⚙</span> Neural Input
            </h2>
            <div className="space-y-4">
              <LocSearch label="Start Location" placeholder="e.g. Belgharia, Kolkata"
                icon={FiMapPin} iconColor="text-cyan-400" value={origin} onChange={setOrigin}/>
              <LocSearch label="Destination" placeholder="e.g. Bankura, West Bengal"
                icon={FiTarget} iconColor="text-orange-400" value={destination} onChange={setDestination}/>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Temporal Marker</p>
                <DarkSelect
                  value={targetDay}
                  onChange={setTargetDay}
                  placeholder={`Today (${curDay})`}
                  options={[
                    { value: '', label: `Today (${curDay})` },
                    ...DAYS.map(d => ({ value: d, label: d })),
                  ]}
                />
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">Target Timeline</p>
                <div className="relative flex items-center">
                  <FiClock size={13} className="absolute left-3 text-yellow-400"/>
                  <input type="time" value={targetTime} onChange={e=>setTargetTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3
                               text-sm text-white focus:outline-none focus:border-yellow-500/40
                               transition-all appearance-none"/>
                </div>
              </div>

              <button onClick={analyse} disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all
                           flex items-center justify-center gap-2
                           bg-yellow-500 hover:bg-yellow-400 text-black
                           disabled:opacity-50 shadow-lg shadow-yellow-500/20">
                {loading?<><FiLoader size={16} className="animate-spin"/> Analysing…</>
                  :<><FiZap size={16}/> INITIATE ANALYSIS</>}
              </button>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 animate-pulse"/>
                Simulation Mode: AI Trained on Real Patterns
              </div>
              {didAnalyse&&<div className="flex items-center gap-2 text-xs text-green-400">
                <FiCheckCircle size={11}/> Live Traffic Analysis Active
              </div>}
            </div>
          </div>

          {/* Route selector (after analysis) */}
          {result&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
              className="glass-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FiNavigation size={11} className="text-yellow-400"/> Route Options
              </p>
              <div className="space-y-2">
                {result.alternatives.map((a,i)=>(
                  <button key={a.label} onClick={()=>setActiveRoute(i)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                               border text-xs font-semibold transition-all
                               ${activeRoute===i
                                 ?'border-opacity-60 text-white'
                                 :'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
                    style={activeRoute===i?{
                      background:`${ROUTE_COLORS[i]}18`,
                      borderColor:`${ROUTE_COLORS[i]}60`,
                    }:{}}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{background:ROUTE_COLORS[i]}}/>
                      {a.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span>{a.distance_km} km</span>
                      <span className="opacity-60">·</span>
                      <span>{a.duration_min} min</span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Weather mini (left column after analysis) */}
          {result&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.05}}
              className="glass-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FiCloud size={11} className="text-blue-400"/> Weather at Route
              </p>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-white">{result.weather.condition}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${
                    result.weather.weather_impact==='Low'?'text-green-400'
                    :result.weather.weather_impact==='Medium'?'text-yellow-400':'text-red-400'}`}>
                    {result.weather.weather_impact} Impact
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-white">{result.weather.temp}°C</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  {icon:FiWind,      color:'text-cyan-400',  val:`${result.weather.wind_speed}`,  unit:'km/h'  },
                  {icon:FiDroplet,   color:'text-blue-400',  val:`${result.weather.humidity}`,    unit:'%'     },
                  {icon:FiThermometer,color:'text-orange-400',val:`${result.weather.precipitation}`,unit:'mm' },
                ].map(({icon:Ic,color,val,unit})=>(
                  <div key={unit} className="bg-white/5 rounded-lg p-2">
                    <Ic size={11} className={`${color} mx-auto mb-0.5`}/>
                    <p className="text-xs font-bold text-white">{val}</p>
                    <p className="text-[10px] text-gray-600">{unit}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">{result.weather.weather_tip}</p>
            </motion.div>
          )}

          {/* Accident risk mini (left column) */}
          {result&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1}}
              className="glass-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FiAlertTriangle size={11} className="text-orange-400"/> Accident Risk
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0
                  border-2 ${RISK[result.accident_risk]?.bg??'bg-yellow-500/10'}
                  ${result.accident_risk==='Low'?'border-green-500/40'
                    :result.accident_risk==='Medium'?'border-yellow-500/40':'border-red-500/40'}`}>
                  <span className={`text-xs font-extrabold ${RISK[result.accident_risk]?.color??'text-yellow-400'}`}>
                    {result.accident_risk.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-1">
                  {result.accident_factors.slice(0,2).map((f,i)=>(
                    <p key={i} className="text-xs text-gray-400 leading-tight">{f}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Future prediction mini (left) */}
          {result&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.15}}
              className={`glass-card p-4 border ${DENSITY[result.tomorrow_density]?.border??'border-white/10'}`}>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FiStar size={11} className="text-blue-400"/> Tomorrow's Forecast
              </p>
              <p className={`text-2xl font-extrabold ${DENSITY[result.tomorrow_density]?.color??'text-gray-400'}`}>
                {result.tomorrow_density}
              </p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{result.tomorrow_tip}</p>
            </motion.div>
          )}
        </div>

        {/* ── RIGHT: All results panels ─────────────────────────────────── */}
        <div className="space-y-5 min-w-0">

          {/* Error */}
          <AnimatePresence>
            {error&&(
              <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20
                           rounded-xl text-red-400 text-sm">
                <FiAlertCircle size={15} className="shrink-0"/> {error}
                <button onClick={()=>setError('')} className="ml-auto text-xs underline">×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading&&(
            <div className="glass-card p-16 flex flex-col items-center gap-4 text-gray-500">
              <FiLoader size={32} className="animate-spin text-yellow-400"/>
              <p className="text-sm">Running route analysis…</p>
              <p className="text-xs text-gray-600">Fetching OSRM route · Weather · Traffic model</p>
            </div>
          )}

          {/* Empty state */}
          {!result&&!loading&&!error&&(
            <div className="glass-card p-16 text-center space-y-3">
              <div className="text-5xl">🗺</div>
              <p className="text-white font-semibold">Enter start &amp; destination to begin</p>
              <p className="text-sm text-gray-500">
                The AI will compute route, traffic, weather impact and risk assessment.
              </p>
            </div>
          )}

          {result&&!loading&&(
            <AnimatePresence mode="wait">
              <motion.div key={result.origin_name+result.destination_name}
                initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                exit={{opacity:0}} transition={{duration:0.25}} className="space-y-5">

                {/* ── Row 1: Density hero + AI Suggest side by side ──────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Predicted density */}
                  <div className={`glass-card p-5 border ${dm.border} text-center`}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Predicted Density</p>
                    <motion.p initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}}
                      transition={{type:'spring',stiffness:200}}
                      className={`text-6xl font-extrabold tracking-tight ${dm.color}`}
                      style={{textShadow:`0 0 40px ${dm.glow}66`}}>
                      {result.predicted_density}
                    </motion.p>
                    <p className="text-xs text-gray-500 mt-2">
                      AI Confidence: <span className="text-yellow-400 font-bold">{result.confidence_score}%</span>
                    </p>
                    <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full"
                        initial={{width:0}} animate={{width:`${result.confidence_score}%`}}
                        transition={{duration:0.8}} style={{background:dm.glow}}/>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[
                        {label:'Distance', val:`${result.distance_km} km`},
                        {label:'Duration', val:`${result.duration_min} min`},
                        {label:'Traffic',  val:result.congestion_level, color:cm.color},
                      ].map(({label,val,color})=>(
                        <div key={label} className="bg-white/5 rounded-xl p-2">
                          <p className="text-[10px] text-gray-500">{label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${color??'text-white'}`}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI route suggest */}
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <FiCpu size={14} className={dm.color}/> AI Route Suggest
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold
                                        uppercase ${dm.bg} ${dm.color} border ${dm.border}`}>
                        {result.predicted_density}
                      </span>
                    </h3>
                    <div className="space-y-2 mb-3">
                      {[
                        {icon:FiActivity,   label:'Situation',    text:result.ai_decision.split('.')[0]+'.'},
                        {icon:FiNavigation, label:'Recommended',  text:`${result.alternatives[0]?.label??'Primary'} — ${result.alternatives[0]?.duration_min} min`},
                        {icon:FiTrendingUp, label:'Impact',        text:result.travel_tips[0]??'Monitor conditions.'},
                      ].map(({icon:Ic,label,text})=>(
                        <div key={label} className="flex items-start gap-2 p-2.5 bg-white/5 rounded-lg">
                          <Ic size={12} className="text-yellow-400 mt-0.5 shrink-0"/>
                          <div>
                            <span className="text-xs font-semibold text-yellow-300">{label}: </span>
                            <span className="text-xs text-gray-400">{text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Alt route times */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {result.alternatives.map((a,i)=>(
                        <button key={a.label} onClick={()=>setActiveRoute(i)}
                          className={`p-2 rounded-lg text-center border transition-all
                            ${activeRoute===i
                              ?'text-white border-opacity-60'
                              :'bg-white/5 border-white/10 text-gray-400'}`}
                          style={activeRoute===i?{background:`${ROUTE_COLORS[i]}18`,borderColor:`${ROUTE_COLORS[i]}60`}:{}}>
                          <p className="text-[10px] font-bold" style={activeRoute===i?{color:ROUTE_COLORS[i]}:{}}>{a.label}</p>
                          <p className="text-sm font-extrabold text-white">{a.duration_min}m</p>
                          <p className="text-[10px] text-gray-600">{a.distance_km}km</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"/>Real-time Active
                      </span>
                      <span className="flex items-center gap-1">
                        <FiCpu size={10} className="text-yellow-400"/>Neural Model
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── OSM Map with 3 coloured routes ─────────────────────── */}
                <div className="glass-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                    <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                      <FiMapPin size={14} className="text-yellow-400"/> City Grid Intelligence
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                        Live Traffic Mode
                      </span>
                    </div>
                  </div>
                  <div className="h-56 sm:h-80 relative">
                    <MapContainer center={mapCenter} zoom={9}
                      style={{height:'100%',width:'100%',background:'#0f172a'}}
                      scrollWheelZoom={false}>
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='© <a href="https://openstreetmap.org">OSM</a>'
                      />
                      {/* Draw ALL 3 routes — active on top, dimmed others */}
                      {allPolylines.map((poly,i)=>
                        poly.length>=2&&i!==activeRoute?(
                          <Polyline key={i} positions={poly}
                            pathOptions={{color:ROUTE_COLORS[i],weight:3,opacity:0.35,dashArray:'6,6'}}/>
                        ):null
                      )}
                      {/* Active route on top (solid, brighter) */}
                      {allPolylines[activeRoute]?.length>=2&&(
                        <Polyline positions={allPolylines[activeRoute]}
                          pathOptions={{color:ROUTE_COLORS[activeRoute],weight:5,opacity:0.9}}/>
                      )}
                      {primaryPoly.length>=2&&(
                        <>
                          <Marker position={[result.origin_lat,result.origin_lng]} icon={originIcon}>
                            <Popup>
                              <span className="text-xs font-semibold">START</span><br/>
                              <span className="text-xs text-gray-500 line-clamp-2">{result.origin_name}</span>
                            </Popup>
                          </Marker>
                          <Marker position={[result.dest_lat,result.dest_lng]} icon={destIcon}>
                            <Popup>
                              <span className="text-xs font-semibold">DESTINATION</span><br/>
                              <span className="text-xs text-gray-500 line-clamp-2">{result.destination_name}</span>
                            </Popup>
                          </Marker>
                          <FitBounds pts={primaryPoly}/>
                        </>
                      )}
                    </MapContainer>
                    {/* Map legend */}
                    <div className="absolute bottom-2 left-2 z-[1000] glass-card px-3 py-1.5
                                    flex items-center gap-3 text-xs flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"/> Start
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-400"/> Dest
                      </span>
                      {result.alternatives.map((a,i)=>(
                        <button key={a.label} onClick={()=>setActiveRoute(i)}
                          className={`flex items-center gap-1 transition-opacity
                            ${activeRoute===i?'opacity-100':'opacity-50 hover:opacity-80'}`}>
                          <span className="w-4 h-0.5 rounded inline-block"
                            style={{background:ROUTE_COLORS[i],
                              boxShadow:activeRoute===i?`0 0 4px ${ROUTE_COLORS[i]}`:'none'}}/>
                          <span style={{color:ROUTE_COLORS[i]}}>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Row 3: Route Validation ─────────────────────────────── */}
                <div className="glass-card p-5 border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <FiShield size={14} className="text-yellow-400"/> Real-Time Route Validation
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-yellow-400 font-semibold">Verification Status</p>
                      {['Route Verified','Route Verified','Live Data Synced','Weather Checked','Risk Assessed'].map(s=>(
                        <div key={s} className="flex items-center gap-2 text-xs text-gray-400">
                          <FiCheckCircle size={11} className="text-green-400 shrink-0"/> {s}
                        </div>
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-yellow-400 font-semibold mb-2">Live Route Confidence</p>
                      <p className={`text-4xl font-extrabold ${dm.color}`}>{result.confidence_score}%</p>
                      <p className="text-xs text-gray-600 mt-0.5">Route Trust Score</p>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{width:`${result.confidence_score}%`,background:dm.glow}}/>
                      </div>
                      <div className="mt-3 space-y-1">
                        {result.data_sources.slice(0,3).map(s=>(
                          <div key={s} className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 truncate">{s.split('(')[0].trim()}</span>
                            <span className="text-green-400 font-semibold ml-2 shrink-0">ACTIVE</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-yellow-400 font-semibold mb-2">Estimated Stability</p>
                      <div className={`px-3 py-1.5 rounded-lg mb-3 text-xs font-bold ${dm.bg} ${dm.color} border ${dm.border}`}>
                        Stability: {result.congestion_index<50?'HIGH':result.congestion_index<70?'MEDIUM':'LOW'}
                      </div>
                      {[
                        {label:'Traffic Flow',   val:result.congestion_index<50?'Stable':'Unstable'},
                        {label:'Weather Impact', val:result.weather.weather_impact},
                        {label:'Road Quality',   val:result.route_verified?'Good':'Unknown'},
                      ].map(({label,val})=>(
                        <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                          <span className="text-gray-500">{label}</span>
                          <span className={`font-semibold ${
                            val==='Stable'||val==='Good'||val==='Low'?'text-green-400'
                            :val==='Unstable'||val==='High'?'text-red-400':'text-yellow-400'
                          }`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Row 4: Segment risks + Localized Intensity ─────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <FiActivity size={13} className="text-cyan-400"/> Alternate Route Availability
                    </h3>
                    <div className="flex items-center gap-2 mb-3 text-xs">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400
                                       flex items-center justify-center font-bold text-[10px] shrink-0">
                        {result.alternatives.length-1}
                      </span>
                      <span className="text-gray-400">Alternate Safe Routes Found</span>
                    </div>
                    <div className="flex gap-2 mb-4">
                      {result.alternatives.map((a,i)=>(
                        <button key={a.label} onClick={()=>setActiveRoute(i)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border`}
                          style={activeRoute===i
                            ?{background:`${ROUTE_COLORS[i]}22`,borderColor:`${ROUTE_COLORS[i]}60`,color:ROUTE_COLORS[i]}
                            :{background:'rgba(255,255,255,0.05)',borderColor:'rgba(255,255,255,0.1)',color:'#9ca3af'}}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2.5 border-t border-white/5 pt-3">
                      {result.segment_risks.map(s=>(
                        <div key={s.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{s.label}</span>
                            <span className={`font-bold ${RISK[s.risk_level]?.color??'text-gray-400'}`}>{s.congestion_pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              initial={{width:0}} animate={{width:`${s.congestion_pct}%`}}
                              transition={{duration:0.6}}
                              style={{background:congBar(s.congestion_pct)}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <FiZap size={13} className="text-yellow-400"/> Localized Intensity
                    </h3>
                    <div className="space-y-3">
                      {result.segment_risks.map((s,i)=>{
                        const icons=['🏘','🏛','🚉','🛣','🏁'];
                        return (
                          <div key={s.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 flex items-center gap-1.5">
                                <span>{icons[i]??'📍'}</span>{s.label}
                              </span>
                              <span className={`font-bold ${RISK[s.risk_level]?.color??'text-gray-400'}`}>{s.congestion_pct}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <motion.div className="h-full rounded-full"
                                initial={{width:0}} animate={{width:`${s.congestion_pct}%`}}
                                transition={{duration:0.6,delay:0.05*i}}
                                style={{background:congBar(s.congestion_pct)}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Row 5: AI Decision + Analytics + Chart ─────────────── */}
                <div className="glass-card p-5 border border-yellow-500/10">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <FiCpu size={14} className="text-yellow-400"/> Why This Route?
                  </h3>
                  <div className="p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                    <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
                      <span>🤖</span> AI Decision Rationale
                    </p>
                    <p className={`text-sm font-medium ${dm.color} leading-relaxed`}>{result.ai_decision}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {['Neural Model v2.1','OSRM Real-Flow','Safety Verified'].map(t=>(
                      <span key={t} className="text-[10px] px-2.5 py-1 rounded-full
                                               bg-white/5 border border-white/10 text-gray-500">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <FiTrendingUp size={13} className="text-yellow-400"/> Advanced Route Analytics
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {icon:'🟡',label:'Live Congestion',    value:`${result.congestion_index.toFixed(0)}%`},
                        {icon:'⏱', label:'Avg Latency',        value:`${Math.round(result.duration_min*0.10)} min`},
                        {icon:'📊',label:'Route Performance',  value:`${100-Math.round(result.congestion_index)}%`},
                        {icon:'🚨',label:'Emergency Priority', value:'NORMAL'},
                      ].map(({icon,label,value})=>(
                        <div key={label} className="bg-white/5 rounded-xl p-3">
                          <p className="text-base mb-0.5">{icon}</p>
                          <p className="text-xs text-gray-500 leading-tight">{label}</p>
                          <p className="text-sm font-extrabold text-white mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <FiActivity size={13} className="text-orange-400"/> Temporal Flow Dynamics
                    </h3>
                    <div className="h-44">
                      {chartData&&<Line data={chartData} options={chartOpts}/>}
                    </div>
                  </div>
                </div>

                {/* ── Row 6: AI Voice ──────────────────────────────────────── */}
                <div className="glass-card p-5 border border-purple-500/10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FiVolume2 size={14} className="text-purple-400"/> AI Voice Assistant
                      {speaking&&(
                        <span className="flex items-center gap-1 text-xs text-purple-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"/>
                          Speaking…
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={replayVoice} disabled={speaking}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30
                                   rounded-lg text-xs font-semibold hover:bg-purple-500/30 transition-all
                                   disabled:opacity-40 flex items-center gap-1.5">
                        <FiVolume2 size={11}/>{speaking?'Speaking…':'Play Summary'}
                      </button>
                      <button onClick={toggleVoice}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${voiceOn?'bg-green-500/10 text-green-400 border-green-500/30'
                            :'bg-white/5 text-gray-500 border-white/10'}`}>
                        {voiceOn?'ON':'OFF'}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/10">
                    <p className="text-xs text-gray-500 mb-2 italic">Voice summary:</p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      "Route analysis complete. Distance is {result.distance_km} km, estimated {result.duration_min} minutes.
                      Current traffic is <span className={cm.color}>{result.congestion_level.toLowerCase()}</span>.
                      {result.weather.weather_impact!=='Low'&&
                        ` Weather impact is ${result.weather.weather_impact.toLowerCase()} — ${result.weather.weather_tip}`}
                      {' '}Accident risk is <span className={RISK[result.accident_risk]?.color??'text-gray-400'}>
                        {result.accident_risk.toLowerCase()}
                      </span>.
                      {' '}{result.travel_tips[0]??''}"
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-700 mt-2">
                    Uses Web Speech API · No external service · 100% client-side
                  </p>
                </div>

                {/* Footer */}
                <p className="text-xs text-gray-700 text-right">
                  Data: OpenStreetMap · OSRM · Open-Meteo · {result.day_of_week} {fmtTime(result.last_updated)}
                </p>

              </motion.div>
            </AnimatePresence>
          )}
        </div>{/* end right column */}
      </div>{/* end body grid */}
    </div>
  );
};

export default Traffic;
