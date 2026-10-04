/**
 * EmergencyResponderCenter.tsx — Emergency Response Command Center
 * Medical / disaster / general emergency coordination for emergency role.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  FiAlertCircle, FiCheckCircle, FiRefreshCw, FiLoader,
  FiMapPin, FiClock, FiX, FiNavigation, FiEye,
  FiSearch, FiFileText, FiActivity, FiAlertOctagon,
  FiPhone,
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
const SetView:React.FC<{lat:number;lng:number}>=({lat,lng})=>{
  const map=useMap();useEffect(()=>{map.setView([lat,lng],14);},[lat,lng,map]);return null;
};

interface Case {
  id:string;type:string;title:string;description:string;priority:string;status:string;created_at:string;
  location_lat?:number|null;location_lng?:number|null;location_address?:string|null;
  tracking_id?:string|null;routed_to?:string|null;admin_notes?:string|null;evidence_note?:string|null;
  images:{image_url:string;file_name?:string}[];
}
interface NearbyFacility{name:string;distance:string;distanceM:number;phone:string;lat:number;lng:number;}

const RESPONDER_ACTIONS=[
  {label:'Accept Request',    status:'in_progress',color:'bg-red-500/20 text-red-400 border-red-500/30'},
  {label:'Dispatch Team',     status:'in_progress',color:'bg-orange-500/20 text-orange-400 border-orange-500/30'},
  {label:'En Route',          status:'in_progress',color:'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'},
  {label:'On Scene',          status:'in_progress',color:'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'},
  {label:'Assistance Active', status:'in_progress',color:'bg-purple-500/20 text-purple-400 border-purple-500/30'},
  {label:'Handover / Resolved',status:'resolved',  color:'bg-green-500/20 text-green-400 border-green-500/30'},
];
const EM_FILTERS=['All','Medical Emergency','Traffic Accident','Flood / Disaster','Women Safety','Rescue','Other / General Complaint'];

const PRIORITY_META:Record<string,{color:string;bg:string;border:string;dot:string}>={
  critical:{color:'text-red-400',   bg:'bg-red-500/10',   border:'border-red-500/30',   dot:'bg-red-400'},
  high:    {color:'text-orange-400',bg:'bg-orange-500/10',border:'border-orange-500/30', dot:'bg-orange-400'},
  medium:  {color:'text-yellow-400',bg:'bg-yellow-500/10',border:'border-yellow-500/30', dot:'bg-yellow-400'},
  low:     {color:'text-green-400', bg:'bg-green-500/10', border:'border-green-500/30',  dot:'bg-green-400'},
};
const STATUS_META:Record<string,{label:string;color:string;bg:string}>={
  assigned:    {label:'New Request',  color:'text-red-400',    bg:'bg-red-500/15'},
  in_progress: {label:'Active',       color:'text-yellow-400', bg:'bg-yellow-500/15'},
  resolved:    {label:'Resolved',     color:'text-green-400',  bg:'bg-green-500/15'},
};

const pm=(p:string)=>PRIORITY_META[p?.toLowerCase()]??PRIORITY_META.medium;
const sm=(s:string)=>STATUS_META[s]??{label:s.replace(/_/g,' '),color:'text-gray-400',bg:'bg-gray-500/15'};
function haversineM(a:number,b:number,c:number,d:number){const R=6371000,dL=(c-a)*Math.PI/180,dN=(d-b)*Math.PI/180,x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function fmtDist(m:number){return m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;}
function timeAgo(iso:string){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000);if(m<1)return'just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`;}

/* ── Case Drawer with nearby hospitals ───────────────────────────────────────── */
const CaseDrawer: React.FC<{
  c:Case;onClose:()=>void;onSaved:(u:Case)=>void;
  authFetch:(url:string,opts?:RequestInit)=>Promise<Response>;
}> = ({c:init,onClose,onSaved,authFetch}) => {
  const navigate=useNavigate();
  const [status,  setStatus]  = useState(init.status==='assigned'?'in_progress':init.status);
  const [remarks, setRemarks] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [nearby,  setNearby]  = useState<NearbyFacility[]>([]);
  const [nearbyLoading,setNearbyLoading]=useState(false);
  const pMeta=pm(init.priority);

  useEffect(()=>{
    if(!init.location_lat||!init.location_lng)return;
    setNearbyLoading(true);
    const q=`[out:json][timeout:10];node["amenity"="hospital"](around:5000,${init.location_lat},${init.location_lng});out 3;`;
    fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:`data=${encodeURIComponent(q)}`})
      .then(r=>r.json()).then(d=>{
        const els:any[]=d.elements||[];
        setNearby(els.slice(0,3).map((el:any)=>{
          const distM=haversineM(init.location_lat!,init.location_lng!,el.lat,el.lon);
          return{name:el.tags?.name||'Nearby Hospital',distance:fmtDist(distM),distanceM:distM,
            phone:el.tags?.phone||el.tags?.['contact:phone']||'108',lat:el.lat,lng:el.lon};
        }).sort((a,b)=>a.distanceM-b.distanceM));
      }).catch(()=>{}).finally(()=>setNearbyLoading(false));
  },[init.location_lat,init.location_lng]);

  const save=async()=>{
    setSaving(true);setError('');
    try{
      const r=await authFetch(`/api/complaints/officer/${init.id}`,{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status,remarks:remarks||undefined}),
      });
      if(!r.ok){setError((await r.json().catch(()=>({}))).detail||'Failed');return;}
      onSaved(await r.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:40}} transition={{duration:0.25}}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        <div className={`h-1 w-full ${pMeta.dot}`}/>
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${pMeta.bg} ${pMeta.color} border ${pMeta.border}`}>{init.priority}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm(init.status).bg} ${sm(init.status).color}`}>{sm(init.status).label}</span>
            </div>
            <h2 className="font-bold text-white truncate">{init.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{init.type} · {timeAgo(init.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3 shrink-0"><FiX size={18}/></button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex gap-2">
            <button onClick={()=>{onClose();navigate(`/case/${init.id}`);}}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-semibold rounded-lg hover:bg-cyan-500/25 transition-all">
              <FiEye size={11}/> Full Case
            </button>
            <button onClick={()=>printCaseReport(init,false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold rounded-lg hover:bg-white/10 transition-all">
              <FiFileText size={11}/> PDF
            </button>
          </div>

          <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
            {init.description||'No description provided.'}
          </div>

          {/* Location + mini map */}
          {init.location_lat&&init.location_lng&&(
            <div className="bg-white/5 rounded-xl overflow-hidden">
              <div className="p-3 flex items-start gap-2">
                <FiMapPin size={12} className="text-red-400 mt-0.5 shrink-0"/>
                <p className="text-xs text-gray-300 flex-1">{init.location_address||`${init.location_lat.toFixed(5)}, ${init.location_lng.toFixed(5)}`}</p>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${init.location_lat},${init.location_lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg hover:opacity-80 shrink-0">
                  <FiNavigation size={9}/> Go
                </a>
              </div>
              <div style={{height:140}}>
                <MapContainer center={[init.location_lat,init.location_lng]} zoom={14} style={{height:'100%',width:'100%'}} scrollWheelZoom={false} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OSM'/>
                  <SetView lat={init.location_lat} lng={init.location_lng}/>
                  <Marker position={[init.location_lat,init.location_lng]}><Popup><span className="text-xs font-semibold">🆘 {init.title}</span></Popup></Marker>
                  {nearby.map((f,i)=><Marker key={i} position={[f.lat,f.lng]}><Popup><span className="text-xs">🏥 {f.name}<br/>{f.distance}</span></Popup></Marker>)}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Nearby hospitals */}
          {(nearbyLoading||nearby.length>0)&&(
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-2 flex items-center gap-1">
                🏥 Nearby Hospitals {nearbyLoading&&<FiLoader size={10} className="animate-spin"/>}
              </p>
              {nearby.map((f,i)=>(
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-600">{f.distance}</p>
                  </div>
                  <a href={`tel:${f.phone}`} className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg hover:opacity-80 shrink-0 ml-2">
                    <FiPhone size={9}/>{f.phone}
                  </a>
                </div>
              ))}
              {!nearbyLoading&&nearby.length===0&&init.location_lat&&(
                <p className="text-xs text-gray-600">No hospitals found within 5km via OpenStreetMap</p>
              )}
            </div>
          )}

          {init.evidence_note&&(
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Patient / Victim Report</p>
              <p className="text-xs text-gray-300">{init.evidence_note}</p>
            </div>
          )}

          {init.admin_notes&&(
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
              <p className="text-[10px] text-red-400 uppercase mb-1">Command Notes</p>
              <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{init.admin_notes}</pre>
            </div>
          )}

          {error&&<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}

          <div>
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Response Actions</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {RESPONDER_ACTIONS.map(a=>(
                <button key={a.label} onClick={()=>setStatus(a.status)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${status===a.status?a.color:'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Response Log / Remarks</label>
            <textarea value={remarks} onChange={e=>setRemarks(e.target.value)}
              placeholder="Patient condition, actions taken, hospital handover details…"
              rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-red-500/40 transition-all resize-none"/>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 disabled:bg-red-500/40 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiCheckCircle size={14}/>}
            {saving?'Saving…':'Update Response'}
          </button>
          <button onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
};

/* ══ Emergency Responder Center ═════════════════════════════════════════════════ */
const EmergencyResponderCenter: React.FC = () => {
  const {authFetch,user}=useAuth();
  const [cases,setCases]=useState<Case[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [selected,setSelected]=useState<Case|null>(null);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('All');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const r=await authFetch('/api/complaints/officer/cases');if(r.ok)setCases(await r.json());else setError('Failed');}
    catch{setError('Network error');}finally{setLoading(false);}
  },[authFetch]);

  useEffect(()=>{load();},[load]);
  const flash=(m:string)=>{setSuccess(m);setTimeout(()=>setSuccess(''),4000);};

  const filtered=cases.filter(c=>{
    const q=search.toLowerCase();
    const matchQ=!q||c.title.toLowerCase().includes(q)||(c.location_address||'').toLowerCase().includes(q)||(c.description||'').toLowerCase().includes(q);
    const matchF=filter==='All'||c.type.toLowerCase().includes(filter.toLowerCase());
    return matchQ&&matchF;
  });

  const active=cases.filter(c=>c.status!=='resolved').length;
  const critical=cases.filter(c=>['critical','high'].includes(c.priority)&&c.status!=='resolved').length;

  return (
    <div style={{width:'100%',minWidth:0,boxSizing:'border-box',paddingBottom:40}}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="text-2xl">🚑</span> Emergency Response Center
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{user?.full_name||user?.username} · Emergency Medical & Disaster Response</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
            <span className="text-xs text-red-400 font-semibold">Active Responder</span>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 transition-all disabled:opacity-50">
            <FiRefreshCw size={14} className={loading?'animate-spin':''}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {label:'Total Requests',val:cases.length,    color:'text-white',       sub:'Assigned'},
          {label:'Active',        val:active,           color:'text-red-400',     sub:'Requiring response',  pulse:active>0},
          {label:'High / Critical',val:critical,        color:'text-orange-400',  sub:'Immediate dispatch',  pulse:critical>0},
          {label:'Resolved',      val:cases.filter(c=>c.status==='resolved').length,color:'text-green-400',sub:'Completed'},
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

      {/* Quick helplines */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {[{n:'108',l:'Ambulance'},{n:'102',l:'Medical'},{n:'112',l:'Emergency'},{n:'101',l:'Fire'},{n:'100',l:'Police'},{n:'1098',l:'Child'}].map(h=>(
          <a key={h.n} href={`tel:${h.n}`}
            className="flex flex-col items-center gap-1 p-2.5 glass-card border border-red-500/15 hover:border-red-500/30 transition-all">
            <span className="text-sm font-extrabold text-red-400">{h.n}</span>
            <span className="text-[10px] text-gray-500">{h.l}</span>
          </a>
        ))}
      </div>

      <div className="flex items-start gap-2.5 p-3 bg-red-500/8 border border-red-500/20 rounded-xl text-xs text-red-300 mb-5">
        <FiAlertOctagon size={13} className="shrink-0 mt-0.5"/>
        <span>Emergency requests routed to your team by Admin. Tap any request to open details, view map, check nearby hospitals and update response status.</span>
      </div>

      <AnimatePresence>
        {success&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <FiCheckCircle size={14}/>{success}</motion.div>}
        {error&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <FiAlertCircle size={14}/>{error}</motion.div>}
      </AnimatePresence>

      <div className="glass-card p-4 mb-5 space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search requests, location, description…"
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500/40 transition-all"/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {EM_FILTERS.map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filter===f?'bg-red-500/20 text-red-400 border-red-500/30':'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading&&<div className="flex items-center justify-center py-16 gap-3 text-gray-500"><FiLoader size={24} className="animate-spin text-red-400"/><span>Loading requests…</span></div>}

      {!loading&&filtered.length===0&&(
        <div className="glass-card p-14 text-center">
          <span className="text-5xl block mb-4">🚑</span>
          <p className="text-white font-semibold">{search||filter!=='All'?'No requests match your filters':'No emergency requests assigned'}</p>
          <p className="text-sm text-gray-500 mt-1">Emergency requests will appear once admin routes them to your team</p>
        </div>
      )}

      {!loading&&filtered.length>0&&(
        <div className="space-y-3">
          {filtered.map((c,i)=>{
            const pMeta=pm(c.priority);const sMeta=sm(c.status);
            const icon=c.type.toLowerCase().includes('medical')||c.type.toLowerCase().includes('accident')?'🚑':c.type.toLowerCase().includes('flood')||c.type.toLowerCase().includes('disaster')?'🌊':c.type.toLowerCase().includes('women')?'🆘':'⚠️';
            return (
              <motion.div key={c.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                onClick={()=>setSelected(c)}
                className={`glass-card p-5 border-l-2 ${pMeta.border} cursor-pointer hover:border-white/20 transition-all`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xl">{icon}</span>
                      <p className="font-bold text-white">{c.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${pMeta.bg} ${pMeta.color} border ${pMeta.border} ${c.priority==='critical'?'animate-pulse':''}`}>{c.priority}</span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-1">{c.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                      {c.tracking_id&&<span className="font-mono text-red-700">{c.tracking_id}</span>}
                      {c.location_address&&<span className="flex items-center gap-1 text-cyan-600"><FiMapPin size={9}/>{c.location_address.split(',')[0]}</span>}
                      <span className="flex items-center gap-1"><FiClock size={9}/>{timeAgo(c.created_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sMeta.bg} ${sMeta.color}`}>{sMeta.label}</span>
                    <button onClick={e=>{e.stopPropagation();setSelected(c);}}
                      className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg hover:opacity-80 transition-all">
                      <FiActivity size={10}/> Respond
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected&&<CaseDrawer c={selected} onClose={()=>setSelected(null)} authFetch={authFetch}
          onSaved={u=>{setCases(p=>p.map(c=>c.id===u.id?u:c));setSelected(null);flash('Response updated');}}/>}
      </AnimatePresence>
    </div>
  );
};

export default EmergencyResponderCenter;
