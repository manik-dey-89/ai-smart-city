/**
 * AdminEmergency.tsx — Emergency Response Command Center
 * Premium admin panel: Incidents + Emergency Requests with full action workflow
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertOctagon, FiFileText, FiRefreshCw, FiLoader,
  FiAlertCircle, FiCheckCircle, FiX, FiPlus, FiSearch,
  FiShield, FiClock, FiMapPin, FiUser, FiActivity,
  FiAlertTriangle, FiNavigation,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Incident {
  id: string; type: string; title: string;
  description?: string | null; severity: string; status: string;
  location_lat?: number | null; location_lng?: number | null;
  created_by?: string | null; creator_username?: string | null;
  created_at: string; updated_at?: string | null;
}
interface EmergencyReq {
  id: string; type: string; title: string;
  description?: string | null; priority: string; status: string;
  is_resolved: boolean;
  location_lat?: number | null; location_lng?: number | null;
  user_id?: string | null; reporter_username?: string | null;
  reporter_email?: string | null;
  created_at: string; updated_at?: string | null;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const INCIDENT_STATUSES  = ['active','reported','verified','assigned','in_progress','resolved','cancelled'];
const EMERGENCY_STATUSES = ['active','reported','verified','assigned','in_progress','resolved','cancelled'];
const SEVERITIES = ['low','medium','high','critical'];
const INCIDENT_TYPES = ['traffic','crime','fire','flood','medical','infrastructure','other'];

const SEVERITY_META: Record<string,{color:string;bg:string;border:string;dot:string}> = {
  low:      {color:'text-green-400', bg:'bg-green-500/10', border:'border-green-500/30',  dot:'bg-green-400'},
  medium:   {color:'text-yellow-400',bg:'bg-yellow-500/10',border:'border-yellow-500/30', dot:'bg-yellow-400'},
  high:     {color:'text-orange-400',bg:'bg-orange-500/10',border:'border-orange-500/30', dot:'bg-orange-400'},
  critical: {color:'text-red-400',   bg:'bg-red-500/10',   border:'border-red-500/30',    dot:'bg-red-400'},
};
const STATUS_META: Record<string,{color:string;bg:string}> = {
  active:      {color:'text-yellow-400',bg:'bg-yellow-500/15'},
  reported:    {color:'text-yellow-400',bg:'bg-yellow-500/15'},
  verified:    {color:'text-blue-400',  bg:'bg-blue-500/15'},
  assigned:    {color:'text-purple-400',bg:'bg-purple-500/15'},
  in_progress: {color:'text-cyan-400',  bg:'bg-cyan-500/15'},
  resolved:    {color:'text-green-400', bg:'bg-green-500/15'},
  cancelled:   {color:'text-gray-400',  bg:'bg-gray-500/15'},
};
const TYPE_ICON: Record<string,string> = {
  traffic:'🚗', crime:'🚔', fire:'🔥', flood:'🌊',
  medical:'🚑', infrastructure:'🏗', other:'⚠️',
  'fire hazard':'🔥', 'general emergency':'🆘',
  'police / crime':'🚔', 'road accident':'💥',
  'flood / disaster':'🌊', 'women safety':'🆘',
};

const smeta = (s:string) => STATUS_META[s?.toLowerCase()] ?? {color:'text-gray-400',bg:'bg-gray-500/15'};
const sevmeta = (s:string) => SEVERITY_META[s?.toLowerCase()] ?? SEVERITY_META.medium;

function fmtDate(iso:string){
  try{return new Date(iso).toLocaleString([],{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
  catch{return iso;}
}
function timeAgo(iso:string){
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if(m<1) return 'just now';
  if(m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

const selectCls=`w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all`;
const inputCls=`w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all`;

/* ── Incident detail/update drawer ─────────────────────────────────────────── */
const IncidentDrawer: React.FC<{
  incident: Incident; onClose:()=>void;
  onSaved:(u:Incident)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({incident,onClose,onSaved,authFetch}) => {
  const [status,   setStatus]   = useState(incident.status);
  const [severity, setSeverity] = useState(incident.severity);
  const [desc,     setDesc]     = useState(incident.description||'');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const sm = smeta(status); const sv = sevmeta(severity);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(`/api/admin/incidents/${incident.id}`,{
        method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status,severity,description:desc}),
      });
      if(!res.ok){setError((await res.json().catch(()=>({}))).detail||'Update failed');return;}
      onSaved(await res.json());
    } catch{setError('Network error');}finally{setSaving(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:40}} transition={{duration:0.25}}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sv.bg} ${sv.color} border ${sv.border}`}>
                {severity.toUpperCase()}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                {status.replace(/_/g,' ').toUpperCase()}
              </span>
              <span className="text-xs text-gray-500 capitalize">{incident.type}</span>
            </div>
            <h2 className="font-bold text-white truncate">{incident.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <FiClock size={10}/> {fmtDate(incident.created_at)}
              {incident.creator_username && <><span className="mx-1">·</span><FiUser size={10}/> {incident.creator_username}</>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3 shrink-0"><FiX size={18}/></button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Location */}
          {(incident.location_lat||incident.location_lng) && (
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl text-xs text-gray-400">
              <FiMapPin size={12} className="text-cyan-400 shrink-0"/>
              <span>{incident.location_lat?.toFixed(5)}, {incident.location_lng?.toFixed(5)}</span>
              <a href={`https://www.google.com/maps?q=${incident.location_lat},${incident.location_lng}`}
                target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-blue-400 hover:underline">
                <FiNavigation size={10}/> View
              </a>
            </div>
          )}

          {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} className={selectCls}>
                {INCIDENT_STATUSES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Severity</label>
              <select value={severity} onChange={e=>setSeverity(e.target.value)} className={selectCls}>
                {SEVERITIES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Notes / Action Taken</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
              className={`${inputCls} resize-none`} placeholder="Add response notes…"/>
          </div>

          {/* Quick action buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {label:'Verify',   newStatus:'verified',    color:'bg-blue-500/15 text-blue-400 border-blue-500/30'},
              {label:'Assign',   newStatus:'assigned',    color:'bg-purple-500/15 text-purple-400 border-purple-500/30'},
              {label:'Resolve',  newStatus:'resolved',    color:'bg-green-500/15 text-green-400 border-green-500/30'},
            ].map(({label,newStatus,color})=>(
              <button key={label} type="button"
                onClick={()=>setStatus(newStatus)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  status===newStatus?color:'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-black font-semibold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiCheckCircle size={14}/>}
            {saving?'Saving…':'Save Changes'}
          </button>
          <button onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Emergency request drawer ───────────────────────────────────────────────── */
const EmergencyDrawer: React.FC<{
  req:EmergencyReq; onClose:()=>void;
  onSaved:(u:EmergencyReq)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({req,onClose,onSaved,authFetch}) => {
  const [status,   setStatus]   = useState(req.status);
  const [resolved, setResolved] = useState(req.is_resolved);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const sm = smeta(status); const sv = sevmeta(req.priority);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(`/api/admin/emergencies/${req.id}`,{
        method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status,is_resolved:resolved}),
      });
      if(!res.ok){setError((await res.json().catch(()=>({}))).detail||'Update failed');return;}
      onSaved(await res.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:40}} transition={{duration:0.25}}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header with priority strip */}
        <div className={`h-1 w-full ${sv.dot}`}/>
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sv.bg} ${sv.color} border ${sv.border}`}>
                {req.priority.toUpperCase()} PRIORITY
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                {status.replace(/_/g,' ').toUpperCase()}
              </span>
              {req.is_resolved && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">✓ RESOLVED</span>}
            </div>
            <h2 className="font-bold text-white truncate">{req.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(req.created_at)} · {timeAgo(req.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3 shrink-0"><FiX size={18}/></button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Reporter info */}
          <div className="bg-white/5 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500 mb-0.5">Reporter</p>
              <p className="text-white font-semibold">{req.reporter_username||'Unknown'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Email</p>
              <p className="text-white truncate">{req.reporter_email||'—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Type</p>
              <p className="text-white capitalize">{req.type}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Priority</p>
              <p className={`font-bold ${sv.color} capitalize`}>{req.priority}</p>
            </div>
          </div>

          {req.description && (
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-300 leading-relaxed">{req.description}</p>
            </div>
          )}

          {(req.location_lat||req.location_lng) && (
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl text-xs text-gray-400">
              <FiMapPin size={12} className="text-red-400 shrink-0"/>
              <span>{req.location_lat?.toFixed(5)}, {req.location_lng?.toFixed(5)}</span>
              <a href={`https://www.google.com/maps?q=${req.location_lat},${req.location_lng}`}
                target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-blue-400 hover:underline">
                <FiNavigation size={10}/> Respond
              </a>
            </div>
          )}

          {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Update Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className={selectCls}>
              {EMERGENCY_STATUSES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s.replace(/_/g,' ')}</option>)}
            </select>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {label:'Verify',  s:'verified',   c:'bg-blue-500/15 text-blue-400 border-blue-500/30'},
              {label:'Assign',  s:'assigned',   c:'bg-purple-500/15 text-purple-400 border-purple-500/30'},
              {label:'Active',  s:'in_progress',c:'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'},
              {label:'Resolve', s:'resolved',   c:'bg-green-500/15 text-green-400 border-green-500/30'},
            ].map(({label,s,c})=>(
              <button key={label} onClick={()=>{setStatus(s);if(s==='resolved')setResolved(true);}}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${status===s?c:'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl">
            <input type="checkbox" checked={resolved} onChange={e=>setResolved(e.target.checked)}
              className="w-4 h-4 rounded accent-green-400"/>
            <div>
              <p className="text-sm text-white font-medium">Mark as Resolved</p>
              <p className="text-xs text-gray-500">Closes this emergency request</p>
            </div>
          </label>
        </div>

        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-black font-semibold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiCheckCircle size={14}/>}
            {saving?'Saving…':'Save Response'}
          </button>
          <button onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Create Incident modal ──────────────────────────────────────────────────── */
const CreateIncidentModal: React.FC<{
  onClose:()=>void; onCreated:(i:Incident)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({onClose,onCreated,authFetch}) => {
  const [form,setForm] = useState({type:'other',title:'',description:'',severity:'medium'});
  const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try{
      const res = await authFetch('/api/admin/incidents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      if(!res.ok){setError((await res.json().catch(()=>({}))).detail||'Create failed');return;}
      onCreated(await res.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.form initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{duration:0.2}}
        onSubmit={save} className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-white text-lg flex items-center gap-2">
            <FiPlus size={16} className="text-cyan-400"/> Log New Incident
          </h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={18}/></button>
        </div>
        {error && <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Incident Type</label>
              <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className={selectCls}>
                {INCIDENT_TYPES.map(t=><option key={t} value={t} className="bg-gray-900 capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Severity</label>
              <select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})} className={selectCls}>
                {SEVERITIES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Incident Title *</label>
            <input type="text" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}
              className={inputCls} placeholder="Brief incident description" required/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Details</label>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})
}              rows={3} className={`${inputCls} resize-none`} placeholder="Incident details, location, resources needed…"/>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-black font-semibold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiPlus size={14}/>}
            {saving?'Creating…':'Log Incident'}
          </button>
          <button type="button" onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">Cancel</button>
        </div>
      </motion.form>
    </div>
  );
};

/* ── Incident row card ──────────────────────────────────────────────────────── */
const IncidentCard: React.FC<{inc:Incident; onClick:()=>void; delay:number}> = ({inc,onClick,delay}) => {
  const sm = smeta(inc.status); const sv = sevmeta(inc.severity);
  const icon = TYPE_ICON[inc.type?.toLowerCase()] ?? '⚠️';
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay}}
      onClick={onClick}
      className={`glass-card p-4 cursor-pointer hover:border-white/20 transition-all group border-l-2 ${sv.border}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl shrink-0 text-lg ${sv.bg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">{inc.title}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${sm.bg} ${sm.color}`}>
              {inc.status.replace(/_/g,' ').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
            <span className={`flex items-center gap-1 font-semibold ${sv.color} capitalize`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sv.dot}`}/>
              {inc.severity}
            </span>
            <span className="capitalize">{inc.type}</span>
            {inc.creator_username && <span className="flex items-center gap-1"><FiUser size={9}/>{inc.creator_username}</span>}
            <span className="flex items-center gap-1 ml-auto"><FiClock size={9}/>{timeAgo(inc.created_at)}</span>
          </div>
        </div>
      </div>
      {inc.description && <p className="text-xs text-gray-500 mt-2 line-clamp-1 pl-12">{inc.description}</p>}
    </motion.div>
  );
};

/* ── Emergency request card ─────────────────────────────────────────────────── */
const EmergencyCard: React.FC<{em:EmergencyReq; onClick:()=>void; delay:number}> = ({em,onClick,delay}) => {
  const sm = smeta(em.status); const sv = sevmeta(em.priority);
  const icon = TYPE_ICON[em.type?.toLowerCase()] ?? '🆘';
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay}}
      onClick={onClick}
      className={`glass-card p-4 cursor-pointer hover:border-white/20 transition-all group border-l-2 ${
        em.is_resolved ? 'border-green-500/40 opacity-70' : sv.border
      }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl shrink-0 text-lg ${sv.bg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">{em.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {em.is_resolved && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">✓</span>}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                {em.status.replace(/_/g,' ').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500">
            <span className={`flex items-center gap-1 font-semibold ${sv.color} capitalize`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sv.dot} ${!em.is_resolved&&em.priority==='critical'?'animate-pulse':''}`}/>
              {em.priority}
            </span>
            <span className="capitalize">{em.type}</span>
            {em.reporter_username && <span className="flex items-center gap-1"><FiUser size={9}/>{em.reporter_username}</span>}
            {em.location_lat && <span className="flex items-center gap-1"><FiMapPin size={9}/>Located</span>}
            <span className="flex items-center gap-1 ml-auto"><FiClock size={9}/>{timeAgo(em.created_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ══ Main Page ══════════════════════════════════════════════════════════════════ */
const AdminEmergency: React.FC = () => {
  const {authFetch} = useAuth();
  const [activeTab, setActiveTab] = useState<'incidents'|'emergencies'>('emergencies');
  const [incidents,   setIncidents]   = useState<Incident[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyReq[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedInc, setSelectedInc] = useState<Incident|null>(null);
  const [selectedEm,  setSelectedEm]  = useState<EmergencyReq|null>(null);
  const [showCreate,  setShowCreate]  = useState(false);

  // Filters
  const [incSearch,    setIncSearch]    = useState('');
  const [incSeverity,  setIncSeverity]  = useState('');
  const [incStatus,    setIncStatus]    = useState('');
  const [emSearch,     setEmSearch]     = useState('');
  const [emPriority,   setEmPriority]   = useState('');
  const [emResolved,   setEmResolved]   = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [incRes,emRes] = await Promise.all([
        authFetch('/api/admin/incidents?limit=200'),
        authFetch('/api/admin/emergencies?limit=200'),
      ]);
      if(incRes.ok) setIncidents(await incRes.json());
      if(emRes.ok)  setEmergencies(await emRes.json());
      if(!incRes.ok||!emRes.ok) setError('Failed to load some data');
    }catch{setError('Network error');}finally{setLoading(false);}
  },[authFetch]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const flash = (msg:string)=>{setSuccessMsg(msg);setTimeout(()=>setSuccessMsg(''),4000);};

  // Filtered lists
  const filteredInc = incidents.filter(i=>{
    const q = incSearch.toLowerCase();
    const matchQ = !q || i.title.toLowerCase().includes(q) || i.type.toLowerCase().includes(q);
    const matchSev = !incSeverity || i.severity===incSeverity;
    const matchSt  = !incStatus   || i.status===incStatus;
    return matchQ && matchSev && matchSt;
  });
  const filteredEm = emergencies.filter(e=>{
    const q = emSearch.toLowerCase();
    const matchQ = !q || e.title.toLowerCase().includes(q) || (e.reporter_username||'').toLowerCase().includes(q);
    const matchP  = !emPriority || e.priority===emPriority;
    const matchR  = emResolved==='' ? true : emResolved==='yes' ? e.is_resolved : !e.is_resolved;
    return matchQ && matchP && matchR;
  });

  // Stats
  const criticalInc   = incidents.filter(i=>i.severity==='critical'&&!['resolved','cancelled'].includes(i.status)).length;
  const activeInc     = incidents.filter(i=>!['resolved','cancelled'].includes(i.status)).length;
  const unresolvedEm  = emergencies.filter(e=>!e.is_resolved).length;
  const criticalEm    = emergencies.filter(e=>e.priority==='critical'&&!e.is_resolved).length;

  return (
    <div className="space-y-5">

      {/* ━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <FiShield size={22} className="text-red-400"/> Emergency Response Center
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Incident management · Citizen emergency requests · Response coordination</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all">
            <FiPlus size={14}/> Log Incident
          </button>
          <button onClick={fetchAll} disabled={loading}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all disabled:opacity-50">
            <FiRefreshCw size={15} className={loading?'animate-spin':''}/>
          </button>
        </div>
      </div>

      {/* ━━ Stats strip ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Emergency Requests', val:emergencies.length,  color:'text-red-400',    icon:FiAlertOctagon, sub:`${unresolvedEm} unresolved`},
          {label:'Critical Emergencies',val:criticalEm,          color:'text-orange-400', icon:FiAlertTriangle, sub:'Immediate response needed'},
          {label:'Active Incidents',   val:activeInc,            color:'text-yellow-400', icon:FiActivity,     sub:`${criticalInc} critical`},
          {label:'Total Incidents',    val:incidents.length,     color:'text-purple-400', icon:FiFileText,     sub:'All time'},
        ].map(({label,val,color,icon:Icon,sub})=>(
          <div key={label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon size={16} className={color}/>
              {val > 0 && label.includes('Critical') && (
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
              )}
            </div>
            <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ━━ Feedback ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {successMsg&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <FiCheckCircle size={14}/>{successMsg}</motion.div>}
        {error&&<motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <FiAlertCircle size={14}/>{error}</motion.div>}
      </AnimatePresence>

      {/* ━━ Tabs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        <button onClick={()=>setActiveTab('emergencies')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
            ${activeTab==='emergencies'?'bg-red-500/20 text-red-400':'text-gray-400 hover:text-white'}`}>
          <FiAlertOctagon size={13}/>
          Emergency Requests
          {unresolvedEm>0&&<span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unresolvedEm}</span>}
        </button>
        <button onClick={()=>setActiveTab('incidents')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all
            ${activeTab==='incidents'?'bg-cyan-500/20 text-cyan-400':'text-gray-400 hover:text-white'}`}>
          <FiFileText size={13}/>
          Incidents ({incidents.length})
        </button>
      </div>

      {/* ━━ EMERGENCY REQUESTS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab==='emergencies' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
                <input value={emSearch} onChange={e=>setEmSearch(e.target.value)}
                  placeholder="Search requests, reporter…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500/40 transition-all"/>
              </div>
              <select value={emPriority} onChange={e=>setEmPriority(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
                <option value="">All Priorities</option>
                {SEVERITIES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s}</option>)}
              </select>
              <select value={emResolved} onChange={e=>setEmResolved(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
                <option value="">All States</option>
                <option value="no"  className="bg-gray-900">Unresolved</option>
                <option value="yes" className="bg-gray-900">Resolved</option>
              </select>
            </div>
          </div>

          {loading && <div className="flex items-center justify-center py-10 gap-3 text-gray-500"><FiLoader size={20} className="animate-spin text-red-400"/><span>Loading…</span></div>}

          {!loading && filteredEm.length===0 && (
            <div className="glass-card p-12 text-center">
              <FiAlertOctagon size={40} className="mx-auto mb-3 text-gray-700"/>
              <p className="text-white font-semibold">{emSearch||emPriority||emResolved ? 'No results match your filters' : 'No emergency requests yet'}</p>
              <p className="text-sm text-gray-500 mt-1">{emSearch||emPriority||emResolved ? 'Try adjusting your filters' : 'Citizen SOS requests will appear here'}</p>
            </div>
          )}

          {!loading && filteredEm.length>0 && (
            <div className="space-y-2.5">
              {filteredEm.map((em,i)=>(
                <EmergencyCard key={em.id} em={em} onClick={()=>setSelectedEm(em)} delay={i*0.03}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━ INCIDENTS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab==='incidents' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
                <input value={incSearch} onChange={e=>setIncSearch(e.target.value)}
                  placeholder="Search incidents…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/40 transition-all"/>
              </div>
              <select value={incSeverity} onChange={e=>setIncSeverity(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
                <option value="">All Severities</option>
                {SEVERITIES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s}</option>)}
              </select>
              <select value={incStatus} onChange={e=>setIncStatus(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
                <option value="">All Statuses</option>
                {INCIDENT_STATUSES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>

          {loading && <div className="flex items-center justify-center py-10 gap-3 text-gray-500"><FiLoader size={20} className="animate-spin text-cyan-400"/><span>Loading…</span></div>}

          {!loading && filteredInc.length===0 && (
            <div className="glass-card p-12 text-center">
              <FiFileText size={40} className="mx-auto mb-3 text-gray-700"/>
              <p className="text-white font-semibold">{incSearch||incSeverity||incStatus ? 'No results match your filters' : 'No incidents logged yet'}</p>
              <p className="text-sm text-gray-500 mt-1">
                {incSearch||incSeverity||incStatus ? 'Try adjusting your filters' : 'Click "Log Incident" to record a new incident'}
              </p>
            </div>
          )}

          {!loading && filteredInc.length>0 && (
            <div className="space-y-2.5">
              {filteredInc.map((inc,i)=>(
                <IncidentCard key={inc.id} inc={inc} onClick={()=>setSelectedInc(inc)} delay={i*0.03}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ━━ Modals ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {selectedInc && <IncidentDrawer incident={selectedInc} onClose={()=>setSelectedInc(null)} authFetch={authFetch}
          onSaved={u=>{setIncidents(p=>p.map(i=>i.id===u.id?u:i));setSelectedInc(null);flash('Incident updated');}}/>}
        {selectedEm  && <EmergencyDrawer req={selectedEm} onClose={()=>setSelectedEm(null)} authFetch={authFetch}
          onSaved={u=>{setEmergencies(p=>p.map(e=>e.id===u.id?u:e));setSelectedEm(null);flash('Emergency response saved');}}/>}
        {showCreate  && <CreateIncidentModal onClose={()=>setShowCreate(false)} authFetch={authFetch}
          onCreated={i=>{setIncidents(p=>[i,...p]);setShowCreate(false);flash('Incident logged');}}/>}
      </AnimatePresence>
    </div>
  );
};

export default AdminEmergency;
