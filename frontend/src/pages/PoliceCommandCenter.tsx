/**
 * PoliceCommandCenter.tsx — Police Emergency Command Center
 * Shows citizen-reported crime/police cases routed to the police department.
 * All data from /api/complaints/officer/cases (routed_to=police).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  FiShield, FiAlertCircle, FiCheckCircle, FiRefreshCw, FiLoader,
  FiMapPin, FiClock, FiX, FiNavigation, FiEye,
  FiSearch, FiFileText, FiActivity,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { printCaseReport } from '../utils/caseReport';

/* ── Leaflet ─────────────────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface Case {
  id:string; type:string; title:string; description:string;
  priority:string; status:string; created_at:string;
  location_lat?:number|null; location_lng?:number|null;
  location_address?:string|null; tracking_id?:string|null;
  routed_to?:string|null; admin_notes?:string|null;
  evidence_note?:string|null;
  images:{image_url:string;file_name?:string}[];
}

/* ── Constants ───────────────────────────────────────────────────────────────── */
const POLICE_ACTIONS = [
  {label:'Accept Case',       status:'in_progress', color:'bg-blue-500/20 text-blue-400 border-blue-500/30'},
  {label:'Under Investigation',status:'in_progress',color:'bg-purple-500/20 text-purple-400 border-purple-500/30'},
  {label:'Escalate',          status:'in_progress', color:'bg-orange-500/20 text-orange-400 border-orange-500/30'},
  {label:'Resolved',          status:'resolved',    color:'bg-green-500/20 text-green-400 border-green-500/30'},
];

const CRIME_FILTERS = ['All','Theft / Robbery','Assault / Criminal Case','Police / Crime','Traffic Accident','Missing Person','Other / General Complaint'];

const PRIORITY_META: Record<string,{color:string;bg:string;border:string;dot:string}> = {
  critical:{color:'text-red-400',   bg:'bg-red-500/10',   border:'border-red-500/30',   dot:'bg-red-400'},
  high:    {color:'text-orange-400',bg:'bg-orange-500/10',border:'border-orange-500/30', dot:'bg-orange-400'},
  medium:  {color:'text-yellow-400',bg:'bg-yellow-500/10',border:'border-yellow-500/30', dot:'bg-yellow-400'},
  low:     {color:'text-green-400', bg:'bg-green-500/10', border:'border-green-500/30',  dot:'bg-green-400'},
};
const STATUS_META: Record<string,{label:string;color:string;bg:string}> = {
  assigned:    {label:'New / Assigned',  color:'text-blue-400',   bg:'bg-blue-500/15'},
  in_progress: {label:'Active',          color:'text-yellow-400', bg:'bg-yellow-500/15'},
  resolved:    {label:'Closed',          color:'text-green-400',  bg:'bg-green-500/15'},
};

const pm = (p:string) => PRIORITY_META[p?.toLowerCase()] ?? PRIORITY_META.medium;
const sm = (s:string) => STATUS_META[s] ?? {label:s.replace(/_/g,' '),color:'text-gray-400',bg:'bg-gray-500/15'};

function timeAgo(iso:string){
  const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000);
  if(m<1)return'just now';if(m<60)return`${m}m ago`;
  const h=Math.floor(m/60);if(h<24)return`${h}h ago`;
  return`${Math.floor(h/24)}d ago`;
}
/* ── Case Detail / Action Drawer ─────────────────────────────────────────────── */
const CaseDrawer: React.FC<{
  c:Case; onClose:()=>void; onSaved:(u:Case)=>void;
  authFetch:(url:string,opts?:RequestInit)=>Promise<Response>;
}> = ({c:init,onClose,onSaved,authFetch}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(init.status==='assigned'?'in_progress':init.status);
  const [remarks,setRemarks]= useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [showMap,setShowMap]= useState(false);
  const pMeta = pm(init.priority);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(`/api/complaints/officer/${init.id}`,{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status,remarks:remarks||undefined}),
      });
      if(!res.ok){setError((await res.json().catch(()=>({}))).detail||'Update failed');return;}
      onSaved(await res.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:40}} transition={{duration:0.25}}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Priority accent bar */}
        <div className={`h-1 w-full ${pMeta.dot}`}/>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${pMeta.bg} ${pMeta.color} border ${pMeta.border}`}>
                {init.priority} PRIORITY
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm(init.status).bg} ${sm(init.status).color}`}>
                {sm(init.status).label}
              </span>
            </div>
            <h2 className="font-bold text-white truncate">{init.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{init.type} · {timeAgo(init.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3 shrink-0"><FiX size={18}/></button>
        </div>

        <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">
          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>{onClose();navigate(`/case/${init.id}`);}}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-semibold rounded-lg hover:bg-cyan-500/25 transition-all">
              <FiEye size={11}/> Full Case
            </button>
            <button onClick={()=>printCaseReport(init,false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold rounded-lg hover:bg-white/10 transition-all">
              <FiFileText size={11}/> PDF
            </button>
          </div>

          {/* Incident info */}
          <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
            {init.description || 'No description provided.'}
          </div>

          {/* Location */}
          {(init.location_address || init.location_lat) && (
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <FiMapPin size={12} className="text-blue-400 mt-0.5 shrink-0"/>
                <p className="text-xs text-gray-300">{init.location_address || `${init.location_lat?.toFixed(5)}, ${init.location_lng?.toFixed(5)}`}</p>
              </div>
              {init.location_lat && init.location_lng && (
                <div className="flex gap-2">
                  <button onClick={()=>setShowMap(!showMap)}
                    className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg hover:opacity-80">
                    <FiMapPin size={9}/> {showMap?'Hide':'View'} Map
                  </button>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${init.location_lat},${init.location_lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg hover:opacity-80">
                    <FiNavigation size={9}/> Respond
                  </a>
                </div>
              )}
              {showMap && init.location_lat && init.location_lng && (
                <div style={{height:160,borderRadius:8,overflow:'hidden'}}>
                  <MapContainer center={[init.location_lat,init.location_lng]} zoom={15}
                    style={{height:'100%',width:'100%'}} scrollWheelZoom={false}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OSM'/>
                    <Marker position={[init.location_lat,init.location_lng]}>
                      <Popup><span className="text-xs font-semibold">{init.title}</span></Popup>
                    </Marker>
                  </MapContainer>
                </div>
              )}
            </div>
          )}

          {/* Evidence */}
          {init.evidence_note && (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Citizen Evidence Note</p>
              <p className="text-xs text-gray-300">{init.evidence_note}</p>
            </div>
          )}

          {/* Admin notes */}
          {init.admin_notes && (
            <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3">
              <p className="text-[10px] text-yellow-400 uppercase mb-1">Command Notes</p>
              <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{init.admin_notes}</pre>
            </div>
          )}

          {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}

          {/* Status update */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Police Response Actions</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {POLICE_ACTIONS.map(a=>(
                <button key={a.label} onClick={()=>setStatus(a.status)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                    status===a.status&&a.label!=='Escalate'?a.color:'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Officer Remarks / Action Taken</label>
            <textarea value={remarks} onChange={e=>setRemarks(e.target.value)}
              placeholder="Document actions taken, observations, next steps…"
              rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-all resize-none"/>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:bg-blue-500/40 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiCheckCircle size={14}/>}
            {saving?'Saving…':'Update Case'}
          </button>
          <button onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
};

/* ══ Police Command Center ══════════════════════════════════════════════════════ */
const PoliceCommandCenter: React.FC = () => {
  const {authFetch,user} = useAuth();
  const [cases, setCases]       = useState<Case[]>([]);
  const [loading,setLoading]    = useState(true);
  const [error, setError]       = useState('');
  const [success,setSuccess]    = useState('');
  const [selected,setSelected]  = useState<Case|null>(null);
  const [search,  setSearch]    = useState('');
  const [filter,  setFilter]    = useState('All');
  const [priFilter,setPriFilter]= useState('');

  const load = useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const r = await authFetch('/api/complaints/officer/cases');
      if(r.ok)setCases(await r.json());
      else setError('Failed to load cases');
    }catch{setError('Network error');}finally{setLoading(false);}
  },[authFetch]);

  useEffect(()=>{load();},[load]);

  const flash=(m:string)=>{setSuccess(m);setTimeout(()=>setSuccess(''),4000);};

  const filtered = cases.filter(c=>{
    const q=search.toLowerCase();
    const matchQ=!q||c.title.toLowerCase().includes(q)||(c.location_address||'').toLowerCase().includes(q);
    const matchF=filter==='All'||c.type.toLowerCase().includes(filter.toLowerCase());
    const matchP=!priFilter||c.priority===priFilter;
    return matchQ&&matchF&&matchP;
  });

  const active   = cases.filter(c=>!['resolved'].includes(c.status)).length;
  const critical = cases.filter(c=>c.priority==='critical'&&c.status!=='resolved').length;
  const resolved = cases.filter(c=>c.status==='resolved').length;

  return (
    <div style={{width:'100%',minWidth:0,boxSizing:'border-box',paddingBottom:40}}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="text-2xl">🚔</span> Police Command Center
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {user?.full_name||user?.username} · Law Enforcement Response
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"/>
            <span className="text-xs text-blue-400 font-semibold">On Duty</span>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all disabled:opacity-50">
            <FiRefreshCw size={14} className={loading?'animate-spin':''}/>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {label:'Total Cases',  val:cases.length, color:'text-white',       sub:'Assigned to you'},
          {label:'Active Cases', val:active,        color:'text-blue-400',   sub:'Requiring response', pulse:active>0},
          {label:'Critical',     val:critical,      color:'text-red-400',    sub:'Immediate action',   pulse:critical>0},
          {label:'Resolved',     val:resolved,      color:'text-green-400',  sub:'Closed cases'},
        ].map(({label,val,color,sub,pulse})=>(
          <div key={label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
              {pulse&&val>0&&<span className={`w-2 h-2 rounded-full ${color.replace('text-','bg-')} animate-pulse`}/>}
            </div>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Disclaimer ── */}
      <div className="flex items-start gap-2.5 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl text-xs text-blue-300 mb-5">
        <FiShield size={13} className="shrink-0 mt-0.5"/>
        <span>Cases shown here are citizen reports routed to Police by the Admin Command Center. All case status updates are synchronized with citizen tracking IDs.</span>
      </div>

      <AnimatePresence>
        {success&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <FiCheckCircle size={14}/>{success}</motion.div>}
        {error&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <FiAlertCircle size={14}/>{error}</motion.div>}
      </AnimatePresence>

      {/* ── Filters ── */}
      <div className="glass-card p-4 mb-5 space-y-3">
        <div className="flex gap-3 flex-col sm:flex-row">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search cases, location…"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/40 transition-all"/>
          </div>
          <select value={priFilter} onChange={e=>setPriFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
            <option value="">All Priorities</option>
            {['critical','high','medium','low'].map(p=><option key={p} value={p} className="bg-gray-900 capitalize">{p}</option>)}
          </select>
        </div>
        {/* Crime type filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {CRIME_FILTERS.map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter===f?'bg-blue-500/20 text-blue-400 border-blue-500/30':'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cases ── */}
      {loading&&<div className="flex items-center justify-center py-16 gap-3 text-gray-500"><FiLoader size={24} className="animate-spin text-blue-400"/><span>Loading cases…</span></div>}

      {!loading&&filtered.length===0&&(
        <div className="glass-card p-14 text-center">
          <span className="text-5xl block mb-4">🚔</span>
          <p className="text-white font-semibold">{search||filter!=='All'||priFilter?'No cases match your filters':'No cases assigned yet'}</p>
          <p className="text-sm text-gray-500 mt-1">{search||filter!=='All'||priFilter?'Try adjusting your filters':'Police cases will appear here once admin routes them to you'}</p>
        </div>
      )}

      {!loading&&filtered.length>0&&(
        <div className="space-y-3">
          {filtered.map((c,i)=>{
            const pMeta=pm(c.priority);const sMeta=sm(c.status);
            return (
              <motion.div key={c.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                className={`glass-card overflow-hidden border-l-2 ${pMeta.border} cursor-pointer hover:border-white/20 transition-all`}
                onClick={()=>setSelected(c)}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-lg">{c.type.toLowerCase().includes('theft')||c.type.toLowerCase().includes('robbery')?'🔓':c.type.toLowerCase().includes('assault')||c.type.toLowerCase().includes('criminal')?'⚖️':c.type.toLowerCase().includes('traffic')?'🚗':'🚔'}</span>
                        <p className="font-bold text-white">{c.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${pMeta.bg} ${pMeta.color} border ${pMeta.border}`}>{c.priority}</span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-1">{c.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                        {c.tracking_id&&<span className="font-mono text-blue-700">{c.tracking_id}</span>}
                        {c.location_address&&<span className="flex items-center gap-1"><FiMapPin size={9}/>{c.location_address.split(',')[0]}</span>}
                        <span className="flex items-center gap-1"><FiClock size={9}/>{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sMeta.bg} ${sMeta.color}`}>{sMeta.label}</span>
                      <button onClick={e=>{e.stopPropagation();setSelected(c);}}
                        className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg hover:opacity-80 transition-all">
                        <FiActivity size={10}/> Respond
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected&&<CaseDrawer c={selected} onClose={()=>setSelected(null)} authFetch={authFetch}
          onSaved={u=>{setCases(p=>p.map(c=>c.id===u.id?u:c));setSelected(null);flash('Case updated');}}/>}
      </AnimatePresence>
    </div>
  );
};

export default PoliceCommandCenter;
