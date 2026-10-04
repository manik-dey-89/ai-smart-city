/**
 * AdminComplaints.tsx — Full admin complaint management
 * Approve/Reject/Route workflow with history timeline
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch, FiRefreshCw, FiLoader, FiAlertCircle,
  FiCheckCircle, FiX, FiMessageSquare, FiMapPin,
  FiShield, FiNavigation, FiClock, FiFileText,
  FiUser, FiEye, FiInfo, FiExternalLink, FiDownload,
} from 'react-icons/fi';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { printCaseReport } from '../utils/caseReport';

/* ── Fix Leaflet icons ─────────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface HistoryEntry {
  id: string; action: string;
  old_status?: string; new_status?: string;
  note?: string; actor_username?: string; created_at: string;
}
interface Complaint {
  id: string; type: string; title: string; description: string;
  priority: string; status: string;
  location_lat?: number|null; location_lng?: number|null;
  location_address?: string|null;
  tracking_id?: string|null; routed_to?: string|null;
  admin_notes?: string|null; evidence_note?: string|null;
  user_id?: string|null; assigned_to?: string|null;
  created_at: string; updated_at?: string|null;
  reporter_username?: string|null;
  reporter_email?: string|null;
  reporter_full_name?: string|null;
  images: {image_url:string;file_name?:string}[];
  history: HistoryEntry[];
}

/* ── Constants ───────────────────────────────────────────────────────────────── */
const STATUSES = ['submitted','under_review','assigned','in_progress','resolved','rejected'];
const PRIORITIES = ['low','medium','high'];
const ROUTE_OPTIONS = [
  {value:'police',          label:'Police Department'},
  {value:'traffic_officer', label:'Traffic Management'},
  {value:'fire_service',    label:'Fire Service'},
  {value:'emergency',       label:'Emergency Response'},
  {value:'municipal',       label:'Municipal / Civic Dept'},
];

const STATUS_META: Record<string,{label:string;color:string;bg:string}> = {
  active:       {label:'Submitted',           color:'text-yellow-400',bg:'bg-yellow-500/15'},
  submitted:    {label:'Submitted',           color:'text-yellow-400',bg:'bg-yellow-500/15'},
  under_review: {label:'Under Review',        color:'text-blue-400',  bg:'bg-blue-500/15'  },
  assigned:     {label:'Assigned',            color:'text-purple-400',bg:'bg-purple-500/15'},
  in_progress:  {label:'In Progress',         color:'text-cyan-400',  bg:'bg-cyan-500/15'  },
  resolved:     {label:'Resolved',            color:'text-green-400', bg:'bg-green-500/15' },
  rejected:     {label:'Rejected',            color:'text-red-400',   bg:'bg-red-500/15'   },
};
const sm = (s:string)=>STATUS_META[s]??{label:s.replace(/_/g,' '),color:'text-gray-400',bg:'bg-gray-500/15'};

function fmtDate(iso:string){
  try{return new Date(iso).toLocaleString([],{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
  catch{return iso;}
}
function priorityColor(p:string){
  return p==='high'?'text-red-400':p==='medium'?'text-yellow-400':'text-green-400';
}

/* ── Timeline ────────────────────────────────────────────────────────────────── */
const Timeline: React.FC<{history:HistoryEntry[]}> = ({history}) => (
  <div className="space-y-0 max-h-64 overflow-y-auto pr-1">
    {[...history].reverse().map((h,i,arr)=>{
      const isLast = i === arr.length-1;
      const meta = sm(h.new_status||h.action);
      return (
        <div key={h.id} className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${meta.bg} text-[9px] font-bold ${meta.color} mt-0.5`}>
              {i+1}
            </div>
            {!isLast&&<div className="w-px flex-1 bg-white/10 my-0.5"/>}
          </div>
          <div className={`${isLast?'':'pb-3'}`}>
            <p className={`text-xs font-semibold ${meta.color} capitalize`}>
              {h.action.replace(/_/g,' ')}
              {h.new_status&&h.new_status!==h.action&&
                <span className="text-gray-600 font-normal"> → {h.new_status.replace(/_/g,' ')}</span>}
            </p>
            {h.note&&<p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{h.note}</p>}
            <p className="text-[10px] text-gray-600 mt-0.5">
              {h.actor_username&&<span>{h.actor_username} · </span>}
              {fmtDate(h.created_at)}
            </p>
          </div>
        </div>
      );
    })}
  </div>
);

/* ── Map View Modal ──────────────────────────────────────────────────────────── */
const MapViewModal: React.FC<{
  lat: number; lng: number; address?: string | null;
  title: string; trackingId?: string | null;
  onClose: () => void;
}> = ({ lat, lng, address, title, trackingId, onClose }) => {
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[200]"
      onClick={onClose}>
      <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
        transition={{ duration:0.2 }}
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background:'rgba(8,16,32,0.97)', border:'1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-mono mb-0.5">{trackingId || 'Case Location'}</p>
            <h3 className="font-bold text-white truncate">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3 shrink-0">
            <FiX size={18}/>
          </button>
        </div>

        {/* Map */}
        <div className="h-72">
          <MapContainer center={[lat, lng]} zoom={15}
            style={{ height:'100%', width:'100%' }} scrollWheelZoom={true}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            <Marker position={[lat, lng]}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{title}</p>
                  {address && <p className="text-gray-500 mt-0.5 max-w-[200px]">{address}</p>}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          {address && (
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <FiMapPin size={11} className="text-cyan-400 mt-0.5 shrink-0"/>
              <span>{address}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600 font-mono">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </p>
            <a href={osmUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline">
              <FiExternalLink size={11}/> Open in OSM
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Detail/Action Modal ─────────────────────────────────────────────────────── */
const CaseModal: React.FC<{
  complaint: Complaint;
  onClose: ()=>void;
  onUpdate: (updated:Complaint)=>void;
  authFetch: (url:string, opts?:RequestInit)=>Promise<Response>;
}> = ({complaint:init, onClose, onUpdate, authFetch}) => {
  const navigate = useNavigate();
  const [c, setC]       = useState(init);
  const [showMap, setShowMap] = useState(false);
  const [tab, setTab]   = useState<'info'|'history'|'action'>('info');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Action form state
  const [actionType, setActionType]   = useState<'approve'|'reject'|'update'|'route'>('approve');
  const [actionNote, setActionNote]   = useState('');
  const [routeTo, setRouteTo]         = useState(c.routed_to||ROUTE_OPTIONS[0].value);
  const [newStatus, setNewStatus]     = useState(c.status);
  const [newPriority, setNewPriority] = useState(c.priority);

  const doAction = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      let url = '', body = {};
      if (actionType==='approve') {
        url=`/api/admin/complaints/${c.id}/approve`;
        body={routed_to:routeTo, note:actionNote||undefined};
      } else if (actionType==='reject') {
        url=`/api/admin/complaints/${c.id}/reject`;
        body={reason:actionNote||'Does not meet verification criteria.'};
      } else if (actionType==='route') {
        url=`/api/admin/complaints/${c.id}/route`;
        body={routed_to:routeTo, note:actionNote||undefined};
      } else {
        url=`/api/admin/complaints/${c.id}`;
        body={status:newStatus, priority:newPriority, admin_notes:actionNote||undefined};
      }
      const method = actionType==='update'?'PUT':'POST';
      const res = await authFetch(url, {
        method, headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
      });
      if (!res.ok){
        const j=await res.json().catch(()=>({}));
        setError(j.detail||'Action failed'); return;
      }
      const updated = await res.json();
      setC(updated); onUpdate(updated);
      setSuccess(
        actionType==='approve'?'Case approved and routed!'
        :actionType==='reject'?'Case rejected.'
        :actionType==='route'?'Case re-routed.'
        :'Case updated.'
      );
      setActionNote('');
      setTimeout(()=>setSuccess(''),3000);
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const selectCls=`w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5
    text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all`;

  return (
    <>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}>
      <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
        transition={{duration:0.2}}
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Modal header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm(c.status).bg} ${sm(c.status).color}`}>
                {sm(c.status).label.toUpperCase()}
              </span>
              {c.tracking_id&&<span className="text-[10px] font-mono text-cyan-600">{c.tracking_id}</span>}
              <span className={`text-[10px] font-semibold capitalize ${priorityColor(c.priority)}`}>
                {c.priority} priority
              </span>
            </div>
            <h2 className="font-bold text-white mt-1 truncate">{c.title}</h2>
            <p className="text-xs text-gray-500">{c.type}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3 shrink-0">
            <FiX size={18}/>
          </button>
        </div>

        {/* Action buttons row below header */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5 bg-white/3">
          <button onClick={() => { onClose(); navigate(`/case/${c.id}`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30
                       text-cyan-400 text-xs font-semibold rounded-lg hover:bg-cyan-500/25 transition-all">
            <FiEye size={11}/> View Full Page
          </button>
          <button onClick={() => printCaseReport(c, false)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 border border-green-500/30
                       text-green-400 text-xs font-semibold rounded-lg hover:bg-green-500/25 transition-all">
            <FiDownload size={11}/> Download PDF
          </button>
          <span className="ml-auto text-[10px] text-gray-600 font-mono">{c.tracking_id}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {([
            {id:'info',    label:'Case Info',  icon:FiInfo},
            {id:'history', label:'History',    icon:FiClock},
            {id:'action',  label:'Take Action',icon:FiShield},
          ] as const).map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${tab===id?'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30':'text-gray-500 hover:text-gray-300'}`}>
              <Icon size={11}/>{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {tab==='info'&&(
            <>
              {/* Reporter */}
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FiUser size={10}/> Reporter
                </p>
                <p className="text-sm font-semibold text-white">
                  {c.reporter_full_name||c.reporter_username||'Unknown'}
                </p>
                <p className="text-xs text-gray-500">{c.reporter_email||'—'}</p>
                <p className="text-xs text-gray-600 mt-1">Filed {fmtDate(c.created_at)}</p>
              </div>
              {/* Description */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-gray-300 leading-relaxed bg-white/5 rounded-xl p-3">
                  {c.description}
                </p>
              </div>
              {/* Location */}
              {(c.location_address||c.location_lat)&&(
                <div className="bg-white/5 rounded-xl p-3 flex items-start gap-2">
                  <FiMapPin size={13} className="text-cyan-400 mt-0.5 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{c.location_address||`${c.location_lat}, ${c.location_lng}`}</p>
                    {c.location_lat&&<p className="text-[10px] text-gray-600 mt-0.5">{c.location_lat?.toFixed(5)}, {c.location_lng?.toFixed(5)}</p>}
                  </div>
                  {c.location_lat && c.location_lng && (
                    <button onClick={() => setShowMap(true)}
                      className="shrink-0 flex items-center gap-1 text-xs text-green-400 bg-green-500/10
                                 border border-green-500/20 px-2.5 py-1 rounded-lg hover:bg-green-500/20 transition-all">
                      <FiMapPin size={10}/> View Map
                    </button>
                  )}
                </div>
              )}
              {/* Evidence */}
              {c.evidence_note&&(
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Evidence Note</p>
                  <p className="text-xs text-gray-300">{c.evidence_note}</p>
                </div>
              )}
              {c.images.length>0&&(
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Evidence Files ({c.images.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {c.images.map((img,i)=>(
                      <div key={i} className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                        {img.image_url.startsWith('data:image')
                          ? <img src={img.image_url} alt="ev" className="w-full h-full object-cover"/>
                          : <FiFileText size={18} className="text-gray-500"/>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Routing info */}
              {c.routed_to&&(
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center gap-2">
                  <FiNavigation size={13} className="text-purple-400"/>
                  <p className="text-xs text-purple-300">
                    Routed to: <span className="font-semibold">
                      {ROUTE_OPTIONS.find(r=>r.value===c.routed_to)?.label||c.routed_to}
                    </span>
                  </p>
                </div>
              )}
              {/* Admin notes */}
              {c.admin_notes&&(
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Admin Notes</p>
                  <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                    {c.admin_notes}
                  </pre>
                </div>
              )}
            </>
          )}

          {tab==='history'&&(
            <div>
              {c.history.length===0
                ? <p className="text-gray-500 text-sm text-center py-8">No history yet.</p>
                : <Timeline history={c.history}/>}
            </div>
          )}

          {tab==='action'&&(
            <div className="space-y-4">
              {/* Action type selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  {id:'approve', label:'Approve & Route', color:'bg-green-500/20 border-green-500/40 text-green-400'},
                  {id:'reject',  label:'Reject',          color:'bg-red-500/20 border-red-500/40 text-red-400'},
                  {id:'route',   label:'Re-Route',        color:'bg-purple-500/20 border-purple-500/40 text-purple-400'},
                  {id:'update',  label:'Update Status',   color:'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'},
                ] as const).map(({id,label,color})=>(
                  <button key={id} onClick={()=>setActionType(id)}
                    className={`py-2 rounded-xl border text-xs font-semibold transition-all
                      ${actionType===id?color:'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Route selector */}
              {(actionType==='approve'||actionType==='route')&&(
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Route to Department</label>
                  <select value={routeTo} onChange={e=>setRouteTo(e.target.value)} className={selectCls}>
                    {ROUTE_OPTIONS.map(r=>(
                      <option key={r.value} value={r.value} className="bg-gray-900">{r.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-600 mt-1">
                    Auto-detected: <span className="text-cyan-600">
                      {ROUTE_OPTIONS.find(r=>r.value===c.routed_to)?.label||'Not yet determined'}
                    </span>
                  </p>
                </div>
              )}

              {/* Status/Priority for update */}
              {actionType==='update'&&(
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Status</label>
                    <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className={selectCls}>
                      {STATUSES.map(s=>(
                        <option key={s} value={s} className="bg-gray-900 capitalize">{s.replace(/_/g,' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Priority</label>
                    <select value={newPriority} onChange={e=>setNewPriority(e.target.value)} className={selectCls}>
                      {PRIORITIES.map(p=>(
                        <option key={p} value={p} className="bg-gray-900 capitalize">{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  {actionType==='reject'?'Rejection Reason':'Admin Note (optional)'}
                </label>
                <textarea value={actionNote} onChange={e=>setActionNote(e.target.value)}
                  placeholder={actionType==='reject'
                    ?'Reason for rejection...'
                    :'Add notes or instructions...'}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white
                             text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50
                             transition-all resize-none"/>
              </div>

              {error&&(
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  <FiAlertCircle size={13}/>{error}
                </div>
              )}
              {success&&(
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
                  <FiCheckCircle size={13}/>{success}
                </div>
              )}

              <button onClick={doAction} disabled={saving}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${actionType==='approve'?'bg-green-500 hover:bg-green-400 text-black'
                   :actionType==='reject'?'bg-red-500 hover:bg-red-400 text-white'
                   :actionType==='route'?'bg-purple-500 hover:bg-purple-400 text-white'
                   :'bg-cyan-500 hover:bg-cyan-400 text-black'}
                  disabled:opacity-40`}>
                {saving?<FiLoader size={15} className="animate-spin"/>:null}
                {saving?'Processing…'
                  :actionType==='approve'?'✓ Approve & Route to Officer'
                  :actionType==='reject'?'✗ Reject Complaint'
                  :actionType==='route'?'⇒ Re-Route Case'
                  :'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
    {/* Map view modal rendered as sibling so it overlays the case modal */}
    {showMap && c.location_lat && c.location_lng && (
      <MapViewModal
        lat={c.location_lat} lng={c.location_lng}
        address={c.location_address} title={c.title}
        trackingId={c.tracking_id}
        onClose={() => setShowMap(false)}
      />
    )}
    </>
  );
};

/* ══ Main ════════════════════════════════════════════════════════════════════ */
const AdminComplaints: React.FC = () => {
  const {authFetch} = useAuth();
  const [complaints, setComplaints]       = useState<Complaint[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, _setFilterType]       = useState('');
  const [filterRoute, setFilterRoute]     = useState('');
  const [selected, setSelected]           = useState<Complaint|null>(null);
  const [mapView, setMapView]             = useState<Complaint|null>(null);
  const [successMsg, setSuccessMsg]       = useState('');

  const fetchComplaints = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams();
      if (search)        p.set('search', search);
      if (filterStatus)  p.set('complaint_status', filterStatus);
      if (filterPriority)p.set('priority', filterPriority);
      if (filterType)    p.set('complaint_type', filterType);
      if (filterRoute)   p.set('routed_to', filterRoute);
      p.set('limit','100');
      const res = await authFetch(`/api/admin/complaints?${p}`);
      if (!res.ok){setError('Failed to load complaints');return;}
      setComplaints(await res.json());
    } catch {setError('Network error');}
    finally {setLoading(false);}
  }, [authFetch, search, filterStatus, filterPriority, filterType, filterRoute]);

  useEffect(()=>{fetchComplaints();},[fetchComplaints]);

  const handleUpdate = (updated:Complaint) => {
    setComplaints(prev=>prev.map(c=>c.id===updated.id?updated:c));
    setSelected(updated);
    setSuccessMsg('Case updated successfully');
    setTimeout(()=>setSuccessMsg(''),4000);
  };

  const selectCls=`bg-white/5 border border-white/10 rounded-xl px-3 py-2
    text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all`;

  const total    = complaints.length;
  const pending  = complaints.filter(c=>['active','submitted','under_review'].includes(c.status)).length;
  const active   = complaints.filter(c=>['assigned','in_progress'].includes(c.status)).length;
  const resolved = complaints.filter(c=>c.status==='resolved').length;
  const rejected = complaints.filter(c=>c.status==='rejected').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Complaint Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">Review, approve, route and track all citizen complaints</p>
        </div>
        <button onClick={fetchComplaints} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10
                     border border-white/10 rounded-xl text-sm text-gray-300 transition-all disabled:opacity-50">
          <FiRefreshCw size={14} className={loading?'animate-spin':''}/>Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {label:'Total',    val:total,    color:'text-white'},
          {label:'Pending',  val:pending,  color:'text-yellow-400'},
          {label:'Active',   val:active,   color:'text-cyan-400'},
          {label:'Resolved', val:resolved, color:'text-green-400'},
          {label:'Rejected', val:rejected, color:'text-red-400'},
        ].map(({label,val,color})=>(
          <div key={label} className="glass-card px-4 py-3">
            <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {successMsg&&(
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
            <FiCheckCircle size={14}/>{successMsg}
          </motion.div>
        )}
        {error&&(
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <FiAlertCircle size={14}/>{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search title, description or tracking ID…"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3
                         text-white text-sm placeholder-gray-500 focus:outline-none
                         focus:border-cyan-500/50 transition-all"/>
          </div>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            {STATUSES.map(s=><option key={s} value={s} className="bg-gray-900 capitalize">{s.replace(/_/g,' ')}</option>)}
          </select>
          <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} className={selectCls}>
            <option value="">All Priorities</option>
            {['low','medium','high'].map(p=><option key={p} value={p} className="bg-gray-900 capitalize">{p}</option>)}
          </select>
          <select value={filterRoute} onChange={e=>setFilterRoute(e.target.value)} className={selectCls}>
            <option value="">All Departments</option>
            {ROUTE_OPTIONS.map(r=><option key={r.value} value={r.value} className="bg-gray-900">{r.label}</option>)}
          </select>
        </div>
      </div>

      {loading&&(
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <FiLoader size={22} className="animate-spin text-cyan-400"/>
          <span>Loading complaints…</span>
        </div>
      )}
      {!loading&&complaints.length===0&&(
        <div className="glass-card p-10 text-center text-gray-500">
          <FiMessageSquare size={32} className="mx-auto mb-3 text-gray-600"/>
          <p>No complaints found.</p>
        </div>
      )}

      {/* Table */}
      {!loading&&complaints.length>0&&(
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  {['Reporter','Title / Type','Tracking ID','Location','Priority','Status','Dept','Action'].map(h=>(
                    <th key={h} className="px-3 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {complaints.map((c,i)=>{
                  const meta = sm(c.status);
                  return (
                    <motion.tr key={c.id}
                      initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.015}}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                      onClick={()=>setSelected(c)}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold shrink-0">
                            {(c.reporter_username||'?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs text-white font-medium">{c.reporter_username||'Unknown'}</p>
                            <p className="text-[10px] text-gray-600 truncate max-w-[80px]">{c.reporter_email||'—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-white font-medium truncate max-w-[160px]">{c.title}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[160px]">{c.type}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] font-mono text-cyan-600">{c.tracking_id||'—'}</span>
                      </td>
                      <td className="px-3 py-3 max-w-[120px]">
                        <p className="text-[10px] text-gray-500 truncate">
                          {c.location_address?.split(',')[0]||'Not set'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold capitalize ${priorityColor(c.priority)}`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[10px] text-gray-500">
                          {ROUTE_OPTIONS.find(r=>r.value===c.routed_to)?.label?.split('/')[0].trim()||'—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={e=>{e.stopPropagation();setSelected(c);}}
                            className="text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10
                                       border border-cyan-500/20 px-2.5 py-1.5 rounded-lg transition-all
                                       flex items-center gap-1">
                            <FiEye size={11}/> View
                          </button>
                          {c.location_lat && c.location_lng && (
                            <button onClick={e=>{e.stopPropagation();setMapView(c);}}
                              className="text-xs text-green-400 hover:text-green-300 bg-green-500/10
                                         border border-green-500/20 px-2.5 py-1.5 rounded-lg transition-all
                                         flex items-center gap-1" title="View complaint location on map">
                              <FiMapPin size={11}/> Map
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 text-xs text-gray-600">
            {complaints.length} complaint{complaints.length!==1?'s':''}
          </div>
        </div>
      )}

      {selected&&(
        <CaseModal complaint={selected} onClose={()=>setSelected(null)}
          onUpdate={handleUpdate} authFetch={authFetch}/>
      )}

      {/* Standalone map view from table row "Map" button */}
      {mapView && mapView.location_lat && mapView.location_lng && (
        <MapViewModal
          lat={mapView.location_lat} lng={mapView.location_lng}
          address={mapView.location_address} title={mapView.title}
          trackingId={mapView.tracking_id}
          onClose={() => setMapView(null)}
        />
      )}
    </div>
  );
};

export default AdminComplaints;
