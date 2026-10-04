/**
 * OfficerComplaints.tsx — Officer Panel
 * Shows cases routed to this officer's role. Officer can update status + add remarks.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FiShield, FiLoader, FiAlertCircle, FiCheckCircle, FiRefreshCw,
  FiMapPin, FiClock, FiFileText, FiX,
  FiInfo, FiNavigation, FiExternalLink, FiDownload, FiEye,
} from 'react-icons/fi';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { printCaseReport } from '../utils/caseReport';

/* ── Fix Leaflet icons ─────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Case {
  id:string; type:string; title:string; description:string;
  priority:string; status:string; created_at:string;
  location_lat?:number|null; location_lng?:number|null;
  location_address?:string|null;
  tracking_id?:string|null; routed_to?:string|null;
  admin_notes?:string|null; evidence_note?:string|null;
  images:{image_url:string;file_name?:string}[];
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const STATUS_META: Record<string,{label:string;color:string;bg:string}> = {
  assigned:    {label:'Assigned',     color:'text-purple-400', bg:'bg-purple-500/10'},
  in_progress: {label:'In Progress',  color:'text-cyan-400',   bg:'bg-cyan-500/10'  },
  resolved:    {label:'Resolved',     color:'text-green-400',  bg:'bg-green-500/10' },
};
const sm = (s:string) => STATUS_META[s] ?? {label:s.replace(/_/g,' '),color:'text-gray-400',bg:'bg-gray-500/10'};

const ROLE_LABELS: Record<string,string> = {
  police:          'Police Department',
  traffic_officer: 'Traffic Management',
  fire_service:    'Fire Service',
  emergency:       'Emergency Response',
  municipal:       'Municipal / Civic Dept',
};

function fmtDate(iso:string){
  try{return new Date(iso).toLocaleString([],{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
  catch{return iso;}
}
function priorityColor(p:string){
  return p==='high'?'text-red-400':p==='medium'?'text-yellow-400':'text-green-400';
}

/* ── Officer Map Modal ───────────────────────────────────────────────────────── */
const OfficerMapModal: React.FC<{
  lat: number; lng: number;
  address?: string | null; title: string;
  trackingId?: string | null; routed_to?: string | null;
  onClose: () => void;
}> = ({ lat, lng, address, title, trackingId, routed_to, onClose }) => {
  // Google Maps directions URL (falls back to OSM if unavailable)
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const osmUrl        = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`;

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
            {routed_to && (
              <p className="text-[10px] text-purple-400 mt-0.5">
                Routed to: {ROLE_LABELS[routed_to] || routed_to}
              </p>
            )}
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

        {/* Footer with Get Directions */}
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          {address && (
            <div className="flex items-start gap-2 text-xs text-gray-400">
              <FiMapPin size={11} className="text-cyan-400 mt-0.5 shrink-0"/>
              <span>{address}</span>
            </div>
          )}
          <p className="text-xs text-gray-600 font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500/20 border border-blue-500/30
                         text-blue-400 text-xs font-semibold rounded-xl hover:bg-blue-500/30 transition-all">
              <FiNavigation size={12}/> Get Directions (Google Maps)
            </a>
            <a href={osmUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10
                         text-gray-400 text-xs font-semibold rounded-xl hover:bg-white/10 transition-all">
              <FiExternalLink size={12}/> Open in OSM
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Update Modal ────────────────────────────────────────────────────────────── */
const UpdateModal: React.FC<{
  c: Case;
  onClose:()=>void;
  onSaved:(updated:Case)=>void;
  authFetch:(url:string,opts?:RequestInit)=>Promise<Response>;
}> = ({c:init, onClose, onSaved, authFetch}) => {
  const navigate = useNavigate();
  const [newStatus, setNewStatus] = useState(
    init.status==='assigned'?'in_progress':init.status
  );
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await authFetch(`/api/complaints/officer/${init.id}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status:newStatus, remarks:remarks||undefined}),
      });
      if (!res.ok){
        const j=await res.json().catch(()=>({}));
        setError(j.detail||'Update failed'); return;
      }
      onSaved(await res.json());
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  const selectCls=`w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5
    text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}>
      <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>

        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-mono text-cyan-600 mb-0.5">{init.tracking_id}</p>
            <h2 className="font-bold text-white text-lg leading-tight">{init.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{init.type}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={18}/></button>
        </div>

        {/* Quick action strip */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5 bg-white/3">
          <button onClick={() => { onClose(); navigate(`/case/${init.id}`); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 border border-cyan-500/30
                       text-cyan-400 text-xs font-semibold rounded-lg hover:bg-cyan-500/25 transition-all">
            <FiEye size={11}/> View Full Case
          </button>
          <button onClick={() => printCaseReport(init, false)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 border border-green-500/30
                       text-green-400 text-xs font-semibold rounded-lg hover:bg-green-500/25 transition-all">
            <FiDownload size={11}/> PDF Report
          </button>
          <span className="ml-auto text-[10px] text-gray-600 font-mono">{init.tracking_id}</span>
        </div>

        <div className="bg-white/5 rounded-xl p-4 mb-4 text-sm text-gray-300 leading-relaxed">
          {init.description}
        </div>

        {init.location_address && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 bg-white/5 rounded-lg px-3 py-2">
            <FiMapPin size={11} className="text-cyan-400"/>
            {init.location_address}
          </div>
        )}

        {init.admin_notes && (
          <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3 mb-4">
            <p className="text-[10px] text-yellow-400 uppercase tracking-wide mb-1">Admin Notes</p>
            <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{init.admin_notes}</pre>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">Update Status</label>
          <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className={selectCls}>
            <option value="in_progress" className="bg-gray-900">In Progress</option>
            <option value="resolved"    className="bg-gray-900">Resolved</option>
          </select>
        </div>

        <div className="mb-5">
          <label className="block text-xs text-gray-400 mb-1.5">Action Remarks</label>
          <textarea value={remarks} onChange={e=>setRemarks(e.target.value)}
            placeholder="Describe what action was taken, current situation, next steps..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white
                       text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50
                       transition-all resize-none"/>
        </div>

        {error&&(
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <FiAlertCircle size={13}/>{error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400
                       disabled:bg-cyan-500/40 text-black font-semibold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiCheckCircle size={14}/>}
            {saving?'Saving…':'Update Case'}
          </button>
          <button onClick={onClose}
            className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-all">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ══ Main ════════════════════════════════════════════════════════════════════ */
const OfficerComplaints: React.FC = () => {
  const {authFetch, user} = useAuth();
  const navigate = useNavigate();
  const [cases, setCases]         = useState<Case[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState<Case|null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [mapCase, setMapCase]     = useState<Case|null>(null);

  const role = user?.roles?.[0]?.name || '';
  const roleLabel = ROLE_LABELS[role] || role;

  const loadCases = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await authFetch('/api/complaints/officer/cases');
      if (!res.ok){setError('Failed to load cases');return;}
      setCases(await res.json());
    } catch {setError('Network error');}
    finally {setLoading(false);}
  }, [authFetch]);

  useEffect(()=>{loadCases();},[loadCases]);

  const handleSaved = (updated:Case) => {
    setCases(prev=>prev.map(c=>c.id===updated.id?updated:c));
    setSelected(null);
    setSuccessMsg('Case updated successfully');
    setTimeout(()=>setSuccessMsg(''),4000);
  };

  const total      = cases.length;
  const assigned   = cases.filter(c=>c.status==='assigned').length;
  const inProgress = cases.filter(c=>c.status==='in_progress').length;
  const resolved   = cases.filter(c=>c.status==='resolved').length;

  return (
    <div className="space-y-5 pb-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <FiShield size={22} className="text-purple-400"/> Officer Case Panel
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {roleLabel} · {user?.full_name||user?.username}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Total Cases',  val:total,      color:'text-white'},
          {label:'Assigned',     val:assigned,   color:'text-purple-400'},
          {label:'In Progress',  val:inProgress, color:'text-cyan-400'},
          {label:'Resolved',     val:resolved,   color:'text-green-400'},
        ].map(({label,val,color})=>(
          <div key={label} className="glass-card p-4">
            <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={loadCases} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10
                     rounded-xl text-xs text-gray-400 hover:text-white transition-all">
          <FiRefreshCw size={13} className={loading?'animate-spin':''}/> Refresh
        </button>
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

      {loading&&(
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <FiLoader size={22} className="animate-spin text-purple-400"/>
          <span>Loading assigned cases…</span>
        </div>
      )}
      {!loading&&cases.length===0&&(
        <div className="glass-card p-12 text-center text-gray-500">
          <FiShield size={36} className="mx-auto mb-3 text-gray-600"/>
          <p className="font-medium">No cases assigned yet.</p>
          <p className="text-sm mt-1">Cases routed to your department will appear here.</p>
        </div>
      )}

      {/* Case cards */}
      {!loading&&cases.map((c,i)=>{
        const meta = sm(c.status);
        const isExpanded = expandedId===c.id;
        return (
          <motion.div key={c.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
            transition={{delay:i*0.04}}
            className="glass-card overflow-hidden">
            {/* Card header */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-white truncate">{c.title}</p>
                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full shrink-0">
                      {c.type}
                    </span>
                    <span className={`text-[10px] font-semibold capitalize shrink-0 ${priorityColor(c.priority)}`}>
                      {c.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{c.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600 flex-wrap">
                    {c.tracking_id&&<span className="font-mono text-cyan-700">{c.tracking_id}</span>}
                    {c.location_address&&(
                      <span className="flex items-center gap-1">
                        <FiMapPin size={10}/>{c.location_address.split(',')[0]}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FiClock size={10}/>{fmtDate(c.created_at)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                  {c.images.length>0&&(
                    <span className="text-[10px] text-gray-600 flex items-center gap-1">
                      <FiFileText size={10}/>{c.images.length} evidence
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                <button onClick={()=>setSelected(c)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400
                             text-black font-semibold text-xs rounded-xl transition-all">
                  <FiShield size={12}/> Update Case
                </button>
                <button onClick={()=>navigate(`/case/${c.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10
                             text-gray-300 text-xs rounded-xl transition-all border border-white/10">
                  <FiEye size={12}/> Full Case
                </button>
                {c.location_lat && c.location_lng && (
                  <button onClick={()=>setMapCase(c)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30
                               text-blue-400 text-xs rounded-xl transition-all border border-blue-500/30"
                    title="View case location on map">
                    <FiNavigation size={12}/> Location
                  </button>
                )}
                <button onClick={()=>setExpandedId(isExpanded?null:c.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10
                             text-gray-300 text-xs rounded-xl transition-all border border-white/10">
                  <FiInfo size={12}/> {isExpanded?'Hide':'Details'}
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded&&(
              <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-3">
                {c.location_address&&(
                  <div className="flex items-start gap-2 bg-white/5 rounded-lg p-3">
                    <FiMapPin size={12} className="text-cyan-400 mt-0.5 shrink-0"/>
                    <p className="text-xs text-gray-300">{c.location_address}</p>
                  </div>
                )}
                {c.evidence_note&&(
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Citizen Evidence Note</p>
                    <p className="text-xs text-gray-300">{c.evidence_note}</p>
                  </div>
                )}
                {c.admin_notes&&(
                  <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-lg p-3">
                    <p className="text-[10px] text-yellow-400 uppercase mb-1">Admin Notes &amp; History</p>
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                      {c.admin_notes}
                    </pre>
                  </div>
                )}
                {c.images.length>0&&(
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase mb-2">Evidence ({c.images.length})</p>
                    <div className="flex gap-2 flex-wrap">
                      {c.images.map((img,j)=>(
                        <div key={j} className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                          {img.image_url.startsWith('data:image')
                            ?<img src={img.image_url} alt="ev" className="w-full h-full object-cover"/>
                            :<FiFileText size={20} className="text-gray-500"/>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}

      {selected&&(
        <UpdateModal c={selected} onClose={()=>setSelected(null)}
          onSaved={handleSaved} authFetch={authFetch}/>
      )}

      {mapCase && mapCase.location_lat && mapCase.location_lng && (
        <OfficerMapModal
          lat={mapCase.location_lat} lng={mapCase.location_lng}
          address={mapCase.location_address} title={mapCase.title}
          trackingId={mapCase.tracking_id} routed_to={mapCase.routed_to}
          onClose={() => setMapCase(null)}
        />
      )}
    </div>
  );
};

export default OfficerComplaints;

