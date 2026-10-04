/**
 * AdminAlerts.tsx — City-Wide Alert Command Center
 * Premium admin panel: create, publish, manage & monitor all city alerts
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiPlus, FiRefreshCw, FiLoader, FiAlertCircle,
  FiCheckCircle, FiX, FiEdit2, FiSearch,
  FiZap, FiShield, FiCloud, FiDroplet,
  FiWind, FiRadio, FiEye, FiToggleLeft, FiToggleRight,
  FiAlertOctagon,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Alert {
  id: string; type: string; title: string; message: string;
  severity: string; status: string;
  area_lat?: number | null; area_lng?: number | null;
  created_at: string; updated_at?: string | null;
  created_by?: string | null;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const ALERT_TYPES  = ['TRAFFIC','WEATHER','EMERGENCY','FLOOD','AIR_QUALITY','GENERAL'];
const SEVERITIES   = ['low','medium','high','critical'];

const TYPE_META: Record<string,{icon:React.ElementType;color:string;bg:string;border:string;label:string}> = {
  TRAFFIC:     {icon:FiZap,          color:'text-orange-400',bg:'bg-orange-500/10',border:'border-orange-500/30',label:'Traffic'},
  WEATHER:     {icon:FiCloud,        color:'text-blue-400',  bg:'bg-blue-500/10',  border:'border-blue-500/30',  label:'Weather'},
  EMERGENCY:   {icon:FiAlertOctagon, color:'text-red-400',   bg:'bg-red-500/10',   border:'border-red-500/30',   label:'Emergency'},
  FLOOD:       {icon:FiDroplet,      color:'text-cyan-400',  bg:'bg-cyan-500/10',  border:'border-cyan-500/30',  label:'Flood'},
  AIR_QUALITY: {icon:FiWind,         color:'text-green-400', bg:'bg-green-500/10', border:'border-green-500/30', label:'Air Quality'},
  GENERAL:     {icon:FiRadio,        color:'text-gray-400',  bg:'bg-gray-500/10',  border:'border-gray-500/30',  label:'General'},
};
const SEV_META: Record<string,{color:string;bg:string;border:string;dot:string}> = {
  low:      {color:'text-green-400', bg:'bg-green-500/10', border:'border-green-500/30',  dot:'bg-green-400'},
  medium:   {color:'text-yellow-400',bg:'bg-yellow-500/10',border:'border-yellow-500/30', dot:'bg-yellow-400'},
  high:     {color:'text-orange-400',bg:'bg-orange-500/10',border:'border-orange-500/30', dot:'bg-orange-400'},
  critical: {color:'text-red-400',   bg:'bg-red-500/10',   border:'border-red-500/30',    dot:'bg-red-400'},
};

const typemeta = (t:string) => TYPE_META[t?.toUpperCase()] ?? TYPE_META.GENERAL;
const sevmeta  = (s:string) => SEV_META[s?.toLowerCase()]  ?? SEV_META.medium;

function fmtDate(iso:string){
  try{return new Date(iso).toLocaleString([],{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
  catch{return iso;}
}
function timeAgo(iso:string){
  const d = Date.now()-new Date(iso).getTime();
  const m = Math.floor(d/60000);
  if(m<1) return 'just now'; if(m<60) return `${m}m ago`;
  const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

const inputCls=`w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all`;
const selectCls=`w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all`;

/* ── Alert form modal ────────────────────────────────────────────────────────── */
const AlertFormModal: React.FC<{
  alert?:Alert|null; onClose:()=>void;
  onSaved:(a:Alert)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({alert,onClose,onSaved,authFetch}) => {
  const isEdit = Boolean(alert);
  const [form,setForm] = useState({
    type:     alert?.type     ?? 'GENERAL',
    title:    alert?.title    ?? '',
    message:  alert?.message  ?? '',
    severity: alert?.severity ?? 'medium',
    area_lat: alert?.area_lat  ? String(alert.area_lat) : '',
    area_lng: alert?.area_lng  ? String(alert.area_lng) : '',
  });
  const [step,   setStep]   = useState<'form'|'preview'|'confirm'>('form');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const tm = typemeta(form.type); const sv = sevmeta(form.severity);
  const TypeIcon = tm.icon;

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body = {
        type:form.type, title:form.title, message:form.message, severity:form.severity,
        area_lat: form.area_lat ? parseFloat(form.area_lat) : null,
        area_lng: form.area_lng ? parseFloat(form.area_lng) : null,
      };
      const res = isEdit
        ? await authFetch(`/api/admin/alerts/${alert!.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
        : await authFetch('/api/admin/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!res.ok){setError((await res.json().catch(()=>({}))).detail||'Save failed');setStep('form');return;}
      onSaved(await res.json());
    }catch{setError('Network error');setStep('form');}finally{setSaving(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} exit={{opacity:0,y:30}} transition={{duration:0.25}}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header with severity accent */}
        <div className={`h-0.5 w-full ${sv.dot}`}/>
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              <FiBell size={16} className="text-yellow-400"/>
              {isEdit?'Edit Alert':'Create City Alert'}
            </h2>
            <div className="flex gap-1.5 mt-1.5">
              {['form','preview','confirm'].map((s)=>(
                <div key={s} className={`h-1 rounded-full transition-all ${step===s?'w-6 bg-yellow-400':'w-3 bg-white/20'}`}/>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={18}/></button>
        </div>

        <AnimatePresence mode="wait">

          {/* Step 1: Form */}
          {step==='form' && (
            <motion.div key="form" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Alert Category</label>
                  <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className={selectCls}>
                    {ALERT_TYPES.map(t=>{const m=typemeta(t);return <option key={t} value={t} className="bg-gray-900">{m.label}</option>;})}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Severity Level</label>
                  <select value={form.severity} onChange={e=>setForm({...form,severity:e.target.value})} className={selectCls}>
                    {SEVERITIES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Alert Title *</label>
                <input type="text" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}
                  className={inputCls} placeholder="e.g. Heavy Rain Warning — Central District" required/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Alert Message *</label>
                <textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})}
                  rows={3} className={`${inputCls} resize-none`}
                  placeholder="Detailed alert message for citizens. Include safety instructions and affected areas." required/>
                <p className="text-[10px] text-gray-600 mt-1">{form.message.length}/500 characters</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Area Latitude <span className="text-gray-600">(opt)</span></label>
                  <input type="number" step="any" value={form.area_lat} onChange={e=>setForm({...form,area_lat:e.target.value})}
                    className={inputCls} placeholder="e.g. 22.5726"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Area Longitude <span className="text-gray-600">(opt)</span></label>
                  <input type="number" step="any" value={form.area_lng} onChange={e=>setForm({...form,area_lng:e.target.value})}
                    className={inputCls} placeholder="e.g. 88.3639"/>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Preview */}
          {step==='preview' && (
            <motion.div key="preview" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="p-5 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Preview — as seen by citizens</p>
              <div className={`rounded-2xl p-5 border ${tm.border} ${tm.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl bg-black/20`}>
                    <TypeIcon size={18} className={tm.color}/>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/20 ${tm.color}`}>{form.type}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/20 ${sevmeta(form.severity).color} capitalize`}>{form.severity}</span>
                    </div>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">ACTIVE</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{form.title||'Alert title…'}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{form.message||'Alert message…'}</p>
                {form.area_lat&&form.area_lng&&(
                  <p className="text-xs text-gray-500 mt-3">📍 Lat {parseFloat(form.area_lat).toFixed(4)}, Lng {parseFloat(form.area_lng).toFixed(4)}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">Published: Now</p>
              </div>
              <p className="text-xs text-yellow-400/80 mt-4 flex items-start gap-1.5">
                <FiShield size={11} className="shrink-0 mt-0.5"/>
                Publishing this alert will make it immediately visible to all citizens on the platform.
              </p>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step==='confirm' && (
            <motion.div key="confirm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="p-5">
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
                  <FiBell size={24} className="text-yellow-400"/>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {isEdit ? 'Save Changes?' : 'Publish Alert?'}
                </h3>
                <p className="text-sm text-gray-400 mb-2">
                  <span className={`font-semibold ${tm.color}`}>{form.type}</span> · <span className={`font-semibold ${sevmeta(form.severity).color} capitalize`}>{form.severity} severity</span>
                </p>
                <p className="text-sm text-white font-medium">"{form.title}"</p>
                {!isEdit && <p className="text-xs text-gray-500 mt-2">This will be immediately visible to all platform users.</p>}
              </div>
              {error && <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer actions */}
        <div className="flex gap-3 p-5 border-t border-white/10">
          {step==='form' && <>
            <button onClick={()=>{if(!form.title.trim()||!form.message.trim()){setError('Title and message are required.');return;}setError('');setStep('preview');}}
              className="flex-1 flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 text-white font-semibold py-2.5 rounded-xl text-sm transition-all">
              <FiEye size={14}/> Preview
            </button>
            <button onClick={()=>{if(!form.title.trim()||!form.message.trim()){setError('Title and message are required.');return;}setError('');setStep('confirm');}}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
              {isEdit?<FiCheckCircle size={14}/>:<FiPlus size={14}/>}
              {isEdit?'Review Changes':'Review Alert'}
            </button>
          </>}
          {step==='preview' && <>
            <button onClick={()=>setStep('form')} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">← Back</button>
            <button onClick={()=>setStep('confirm')} className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
              Continue →
            </button>
          </>}
          {step==='confirm' && <>
            <button onClick={()=>setStep('preview')} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">← Back</button>
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/40 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
              {saving?<FiLoader size={14} className="animate-spin"/>:<FiBell size={14}/>}
              {saving?'Publishing…':isEdit?'Save Changes':'Publish Alert'}
            </button>
          </>}
        </div>
      </motion.div>
    </div>
  );
};

/* ── Alert card ─────────────────────────────────────────────────────────────── */
const AlertCard: React.FC<{
  alert:Alert; onEdit:()=>void; onToggle:()=>void; delay:number;
}> = ({alert:a,onEdit,onToggle,delay}) => {
  const tm = typemeta(a.type); const sv = sevmeta(a.severity);
  const TypeIcon = tm.icon;
  const isActive = a.status==='active';

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay}}
      className={`glass-card overflow-hidden transition-all hover:border-white/20 ${!isActive?'opacity-60':''}`}>
      {/* Severity top bar */}
      <div className={`h-1 w-full ${isActive?sv.dot:'bg-gray-600'}`}/>

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${tm.bg}`}>
              <TypeIcon size={15} className={tm.color}/>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tm.bg} ${tm.color}`}>{tm.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sv.bg} ${sv.color} border ${sv.border} capitalize`}>{a.severity}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              isActive?'bg-green-500/15 text-green-400 border-green-500/30':'bg-gray-500/15 text-gray-500 border-gray-500/20'}`}>
              {isActive&&<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>}
              {isActive?'LIVE':'INACTIVE'}
            </div>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{a.title}</h3>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">{a.message}</p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[10px] text-gray-600 mb-4 flex-wrap">
          <span>{fmtDate(a.created_at)}</span>
          <span>·</span>
          <span>{timeAgo(a.created_at)}</span>
          {a.area_lat&&a.area_lng&&<>
            <span>·</span>
            <a href={`https://www.google.com/maps?q=${a.area_lat},${a.area_lng}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:underline flex items-center gap-0.5">📍 View area</a>
          </>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={onToggle}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex-1 justify-center ${
              isActive?'bg-gray-500/10 border-gray-500/20 text-gray-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
              :'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'}`}>
            {isActive?<><FiToggleLeft size={13}/> Deactivate</>:<><FiToggleRight size={13}/> Activate</>}
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 transition-all">
            <FiEdit2 size={12}/> Edit
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ══ Main Page ══════════════════════════════════════════════════════════════════ */
const AdminAlerts: React.FC = () => {
  const {authFetch} = useAuth();
  const [alerts,    setAlerts]    = useState<Alert[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [successMsg,setSuccessMsg]= useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [search,       setSearch]       = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editAlert, setEditAlert] = useState<Alert|null>(null);

  const fetchAlerts = useCallback(async()=>{
    setLoading(true); setError('');
    try{
      const p = new URLSearchParams();
      if(filterStatus) p.set('alert_status',filterStatus);
      if(filterType)   p.set('alert_type',filterType);
      p.set('limit','200');
      const res = await authFetch(`/api/admin/alerts?${p}`);
      if(!res.ok){setError('Failed to load alerts');return;}
      setAlerts(await res.json());
    }catch{setError('Network error');}finally{setLoading(false);}
  },[authFetch,filterStatus,filterType]);

  useEffect(()=>{fetchAlerts();},[fetchAlerts]);

  const flash = (msg:string)=>{setSuccessMsg(msg);setTimeout(()=>setSuccessMsg(''),4000);};

  const toggleStatus = async(a:Alert)=>{
    const ep = a.status==='active'?`/api/admin/alerts/${a.id}/deactivate`:`/api/admin/alerts/${a.id}/activate`;
    try{
      const res = await authFetch(ep,{method:'POST'});
      if(!res.ok){setError('Failed to update alert status');return;}
      const u:Alert = await res.json();
      setAlerts(p=>p.map(x=>x.id===u.id?u:x));
      flash(`Alert ${u.status==='active'?'activated and live':'deactivated'}`);
    }catch{setError('Network error');}
  };

  const handleSaved = (saved:Alert)=>{
    setAlerts(p=>{const ex=p.find(a=>a.id===saved.id); return ex?p.map(a=>a.id===saved.id?saved:a):[saved,...p];});
    setShowForm(false); setEditAlert(null);
    flash(editAlert?'Alert updated successfully':'Alert published and live');
  };

  const filtered = alerts.filter(a=>{
    const q = search.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
    return matchQ;
  });

  const active   = alerts.filter(a=>a.status==='active').length;
  const inactive = alerts.filter(a=>a.status!=='active').length;
  const critical = alerts.filter(a=>a.severity==='critical'&&a.status==='active').length;

  return (
    <div className="space-y-5">

      {/* ━━ Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <FiBell size={22} className="text-yellow-400"/> Alert Command Center
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Publish, manage and monitor city-wide alerts across all citizen panels</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{setEditAlert(null);setShowForm(true);}}
            className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-yellow-500/20">
            <FiPlus size={14}/> Create Alert
          </button>
          <button onClick={fetchAlerts} disabled={loading}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 transition-all disabled:opacity-50">
            <FiRefreshCw size={15} className={loading?'animate-spin':''}/>
          </button>
        </div>
      </div>

      {/* ━━ Stats ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Total Alerts',   val:alerts.length, color:'text-white',        sub:'All time'},
          {label:'Live / Active',  val:active,         color:'text-green-400',   sub:'Visible to citizens', pulse:active>0},
          {label:'Critical Active',val:critical,       color:'text-red-400',     sub:'Immediate attention',  pulse:critical>0},
          {label:'Inactive',       val:inactive,       color:'text-gray-400',    sub:'Deactivated'},
        ].map(({label,val,color,sub,pulse})=>(
          <div key={label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
              {pulse&&val>0&&<span className="w-2 h-2 rounded-full bg-current animate-pulse" style={{color:'inherit'}}/>}
            </div>
            <p className="text-xs text-gray-400 font-medium">{label}</p>
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

      {/* ━━ Filters & Search ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search alerts by title or message…"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500/40 transition-all"/>
          </div>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
            <option value="">All Statuses</option>
            <option value="active"   className="bg-gray-900">Active</option>
            <option value="inactive" className="bg-gray-900">Inactive</option>
          </select>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-all">
            <option value="">All Categories</option>
            {ALERT_TYPES.map(t=><option key={t} value={t} className="bg-gray-900">{typemeta(t).label}</option>)}
          </select>
        </div>
        {/* Category quick-filter pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {ALERT_TYPES.map(t=>{
            const m=typemeta(t); const Icon=m.icon;
            const isActive=filterType===t;
            return (
              <button key={t} onClick={()=>setFilterType(isActive?'':t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive?`${m.bg} ${m.color} ${m.border}`:'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                <Icon size={11}/>{m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ━━ Content ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <FiLoader size={22} className="animate-spin text-yellow-400"/><span>Loading alerts…</span>
        </div>
      )}

      {!loading && filtered.length===0 && (
        <div className="glass-card p-14 text-center">
          <FiBell size={44} className="mx-auto mb-4 text-gray-700"/>
          <p className="text-white font-semibold text-lg">
            {search||filterStatus||filterType ? 'No alerts match your filters' : 'No alerts yet'}
          </p>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            {search||filterStatus||filterType
              ? 'Try adjusting your search or filters'
              : 'Create your first city-wide alert to notify citizens'}
          </p>
          {!search&&!filterStatus&&!filterType&&(
            <button onClick={()=>{setEditAlert(null);setShowForm(true);}}
              className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-sm transition-all">
              <FiPlus size={14}/> Create First Alert
            </button>
          )}
        </div>
      )}

      {!loading && filtered.length>0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((a,i)=>(
            <AlertCard key={a.id} alert={a} delay={i*0.03}
              onEdit={()=>{setEditAlert(a);setShowForm(true);}}
              onToggle={()=>toggleStatus(a)}/>
          ))}
        </div>
      )}

      {/* ━━ Form modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AnimatePresence>
        {showForm && (
          <AlertFormModal alert={editAlert}
            onClose={()=>{setShowForm(false);setEditAlert(null);}}
            onSaved={handleSaved} authFetch={authFetch}/>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAlerts;
