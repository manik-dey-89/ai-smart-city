/**
 * CaseDetailPage.tsx — Full-page case detail view
 * Single unified scroll. Grid uses align-items:start so columns never stretch.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import {
  FiArrowLeft, FiMapPin, FiClock, FiUser, FiShield,
  FiNavigation, FiFileText, FiCheckCircle, FiX,
  FiLoader, FiAlertCircle, FiDownload, FiEye,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { printCaseReport, ReportComplaint } from '../utils/caseReport';

/* ── Leaflet icon fix ───────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface HistoryEntry {
  id: string; action: string;
  old_status?: string; new_status?: string;
  note?: string; actor_username?: string; created_at: string;
}
interface Complaint {
  id: string; type: string; title: string; description: string;
  priority: string; status: string;
  location_lat?: number | null; location_lng?: number | null;
  location_address?: string | null;
  tracking_id?: string | null; routed_to?: string | null;
  admin_notes?: string | null; evidence_note?: string | null;
  user_id?: string | null; assigned_to?: string | null;
  created_at: string; updated_at?: string | null;
  reporter_username?: string | null;
  reporter_email?: string | null;
  reporter_full_name?: string | null;
  images: { image_url: string; file_name?: string }[];
  history: HistoryEntry[];
}

/* ── Lookup tables ──────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:       { label: 'Submitted',           color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  submitted:    { label: 'Submitted',           color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  under_review: { label: 'Under Review',        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30'   },
  assigned:     { label: 'Assigned to Officer', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  in_progress:  { label: 'In Progress',         color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30'   },
  resolved:     { label: 'Resolved',            color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
  rejected:     { label: 'Rejected',            color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    },
};
const ROUTE_LABELS: Record<string, string> = {
  police: 'Police Department', traffic_officer: 'Traffic Management',
  fire_service: 'Fire Service', emergency: 'Emergency Response',
  municipal: 'Municipal / Civic Dept',
};
const sm  = (s: string) => STATUS_META[s] ?? { label: s.replace(/_/g,' '), color:'text-gray-400', bg:'bg-gray-500/10', border:'border-gray-500/20' };
const pc  = (p: string) => p==='high'?'text-red-400':p==='medium'?'text-yellow-400':'text-green-400';
const pb  = (p: string) => p==='high'?'bg-red-500/10 border-red-500/30':p==='medium'?'bg-yellow-500/10 border-yellow-500/30':'bg-green-500/10 border-green-500/30';
const fmt = (iso: string) => {
  try { return new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch { return iso; }
};

/* ── Section wrapper — consistent card style ────────────────────────────────── */
const Section: React.FC<{ children: React.ReactNode; extra?: string }> = ({ children, extra='' }) => (
  <div
    style={{ boxSizing:'border-box', width:'100%', minWidth:0 }}
    className={`glass-card p-5 w-full ${extra}`}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
    {icon}{children}
  </h2>
);

/* ── Timeline ───────────────────────────────────────────────────────────────── */
const Timeline: React.FC<{ history: HistoryEntry[] }> = ({ history }) => (
  <div>
    {[...history].reverse().map((h, i, arr) => {
      const isLast = i === arr.length - 1;
      const meta   = sm(h.new_status || h.action);
      const ICONS: Record<string,React.ElementType> = {
        submitted: FiFileText, approved: FiCheckCircle,
        rejected: FiX, status_change: FiClock, rerouted: FiNavigation,
      };
      const Icon = ICONS[h.action] || FiClock;
      return (
        <div key={h.id} style={{display:'flex', gap:'12px', boxSizing:'border-box'}}>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0}}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${meta.bg} border ${meta.border}`}>
              <Icon size={13} className={meta.color} />
            </div>
            {!isLast && <div style={{width:'1px', flex:1, minHeight:'16px', background:'rgba(255,255,255,0.08)', margin:'4px 0'}}/>}
          </div>
          <div style={{paddingBottom: isLast ? 0 : '20px', minWidth:0, flex:1}}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${meta.color} capitalize`}>
                {h.action.replace(/_/g,' ')}
                {h.new_status && h.new_status !== h.action && (
                  <span className="text-gray-500 font-normal text-xs">
                    {' → '}{STATUS_META[h.new_status]?.label || h.new_status.replace(/_/g,' ')}
                  </span>
                )}
              </p>
              <span className="text-xs text-gray-600 shrink-0">{fmt(h.created_at)}</span>
            </div>
            {h.note && <p className="text-sm text-gray-300 mt-1 leading-relaxed">{h.note}</p>}
            {h.actor_username && <p className="text-xs text-gray-600 mt-1">By: {h.actor_username}</p>}
          </div>
        </div>
      );
    })}
  </div>
);

/* ══ Main ═══════════════════════════════════════════════════════════════════════ */
const CaseDetailPage: React.FC = () => {
  const { id }         = useParams<{ id: string }>();
  const { authFetch, user } = useAuth();
  const navigate       = useNavigate();
  const [complaint, setComplaint] = useState<Complaint|null>(null);
  const [loading, setLoading]     = useState(true);
  const [error,   setError]       = useState('');

  const role       = user?.roles?.[0]?.name || '';
  const isAdmin    = ['admin','city_admin','super_admin'].includes(role);
  const isOfficer  = ['police','traffic_officer','fire_service','emergency','municipal'].includes(role);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const endpoint = isAdmin
      ? `/api/admin/complaints/${id}`
      : isOfficer
        ? `/api/complaints/officer/case/${id}`
        : `/api/complaints/${id}`;
    authFetch(endpoint)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setComplaint)
      .catch(() => setError('Could not load case details.'))
      .finally(() => setLoading(false));
  }, [id, isAdmin, isOfficer, authFetch]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 gap-3 text-gray-500">
      <FiLoader size={28} className="animate-spin text-cyan-400"/>
      <span>Loading case details…</span>
    </div>
  );

  if (error || !complaint) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <FiAlertCircle size={40} className="text-red-400"/>
      <p className="text-white font-semibold">{error || 'Case not found'}</p>
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 rounded-xl text-gray-300 hover:text-white transition-all">
        <FiArrowLeft size={14}/> Go Back
      </button>
    </div>
  );

  const meta     = sm(complaint.status);
  const hasPDF   = () => complaint && printCaseReport(complaint as ReportComplaint, !isAdmin && !isOfficer);
  const statusOrder = ['submitted','active','under_review','assigned','in_progress','resolved'];

  return (
    /* Outer wrapper: full width, normal block flow, no overflow:hidden, no min-height */
    <div
      style={{ width:'100%', minWidth:0, boxSizing:'border-box', paddingBottom:'48px' }}
      className="w-full">

      {/* ── Constrained inner container ── */}
      <div style={{ maxWidth:'1200px', width:'100%', margin:'0 auto', boxSizing:'border-box' }}>

        {/* ━━ Top action bar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-all">
            <FiArrowLeft size={16}/> Back
          </button>
          <button onClick={hasPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/15 border border-green-500/30
                       text-green-400 rounded-xl text-sm font-semibold hover:bg-green-500/25 transition-all">
            <FiDownload size={14}/> Download PDF Report
          </button>
        </div>

        {/* ━━ Hero card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <motion.div
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
          style={{ width:'100%', minWidth:0, boxSizing:'border-box', marginBottom:'20px' }}
          className={`glass-card p-6 border ${meta.border}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div style={{ flex:1, minWidth:0 }}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${meta.bg} ${meta.color} border ${meta.border}`}>
                  {meta.label}
                </span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border capitalize ${pb(complaint.priority)} ${pc(complaint.priority)}`}>
                  {complaint.priority} priority
                </span>
                {complaint.tracking_id && (
                  <span className="text-xs font-mono text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20">
                    {complaint.tracking_id}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-1">{complaint.title}</h1>
              <p className="text-gray-400 text-sm">{complaint.type}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-600">Filed</p>
              <p className="text-sm text-white font-medium">{fmt(complaint.created_at)}</p>
              {complaint.updated_at && <>
                <p className="text-xs text-gray-600 mt-1">Updated</p>
                <p className="text-sm text-white">{fmt(complaint.updated_at)}</p>
              </>}
            </div>
          </div>
        </motion.div>

        {/* ━━ Two-column body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            Key: display:grid with align-items:start so each cell is only as
            tall as its content — the right column NEVER stretches to match
            the left, eliminating the blank gap.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr)',   /* mobile: 1 col */
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box',
          alignItems: 'start',                    /* ← prevents height stretching */
        }}
        /* Override to 2 cols on ≥1024 px via className — Tailwind handles it */
        className="lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px', minWidth:0 }}>

            {/* Description */}
            <Section>
              <SectionTitle icon={<FiFileText size={13} className="text-cyan-400"/>}>
                Detailed Description
              </SectionTitle>
              <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">
                {complaint.description}
              </p>
            </Section>

            {/* Evidence note */}
            {complaint.evidence_note && (
              <Section extra="border border-green-500/15">
                <SectionTitle icon={<FiEye size={13} className="text-green-400"/>}>
                  Evidence Note
                </SectionTitle>
                <p className="text-green-300 text-sm leading-relaxed">{complaint.evidence_note}</p>
              </Section>
            )}

            {/* Evidence images */}
            {complaint.images.length > 0 && (
              <Section>
                <SectionTitle icon={<FiFileText size={13} className="text-purple-400"/>}>
                  Evidence Files ({complaint.images.length})
                </SectionTitle>
                <div className="flex gap-3 flex-wrap">
                  {complaint.images.map((img, i) => (
                    <div key={i}
                      className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                      {img.image_url.startsWith('data:image')
                        ? <img src={img.image_url} alt={img.file_name||'ev'} className="w-full h-full object-cover"/>
                        : <FiFileText size={28} className="text-gray-500"/>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Admin / officer notes */}
            {(isAdmin || isOfficer) && complaint.admin_notes && (
              <Section extra="border border-yellow-500/15">
                <SectionTitle icon={<FiShield size={13} className="text-yellow-400"/>}>
                  Administrative Notes
                </SectionTitle>
                <pre className="text-yellow-200/80 text-xs whitespace-pre-wrap font-sans leading-relaxed">
                  {complaint.admin_notes}
                </pre>
              </Section>
            )}

            {/* History timeline */}
            {complaint.history.length > 0 && (
              <Section>
                <SectionTitle icon={<FiClock size={13} className="text-orange-400"/>}>
                  Case History &amp; Activity
                </SectionTitle>
                <Timeline history={complaint.history}/>
              </Section>
            )}
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px', minWidth:0 }}>

            {/* Case meta */}
            <Section>
              <SectionTitle>Case Details</SectionTitle>
              <div className="space-y-3">
                {([
                  { label:'Tracking ID', val: complaint.tracking_id||'—',    mono:true },
                  { label:'Status',      val: meta.label,                     color:meta.color },
                  { label:'Priority',    val: complaint.priority,             color:pc(complaint.priority), cap:true },
                  { label:'Type',        val: complaint.type },
                  { label:'Department',  val: complaint.routed_to
                      ? (ROUTE_LABELS[complaint.routed_to]||complaint.routed_to)
                      : 'Pending Review' },
                ] as {label:string;val:string;mono?:boolean;color?:string;cap?:boolean}[])
                  .map(({ label, val, mono, color, cap }) => (
                  <div key={label} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-500 shrink-0">{label}</span>
                    <span className={`text-right font-medium break-all
                      ${color||'text-white'}
                      ${mono?'font-mono text-xs':''}
                      ${cap?'capitalize':''}`}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Reporter */}
            {(isAdmin || isOfficer) && (complaint.reporter_username || complaint.reporter_full_name) && (
              <Section>
                <SectionTitle icon={<FiUser size={11}/>}>Reporter</SectionTitle>
                <p className="text-sm font-semibold text-white">
                  {complaint.reporter_full_name || complaint.reporter_username}
                </p>
                {complaint.reporter_email && (
                  <p className="text-xs text-gray-500 mt-1">{complaint.reporter_email}</p>
                )}
                {complaint.reporter_username && (
                  <p className="text-xs text-gray-600 mt-0.5">@{complaint.reporter_username}</p>
                )}
              </Section>
            )}

            {/* Location text */}
            {complaint.location_address && (
              <Section>
                <SectionTitle icon={<FiMapPin size={11} className="text-cyan-400"/>}>Location</SectionTitle>
                <p className="text-sm text-gray-300 leading-relaxed">{complaint.location_address}</p>
                {complaint.location_lat && (
                  <p className="text-xs text-gray-600 mt-1 font-mono">
                    {complaint.location_lat.toFixed(5)}, {complaint.location_lng?.toFixed(5)}
                  </p>
                )}
              </Section>
            )}

            {/* Map */}
            {complaint.location_lat && complaint.location_lng && (
              <div style={{ width:'100%', minWidth:0, boxSizing:'border-box' }}
                className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <FiMapPin size={11} className="text-green-400"/> Complaint Location
                  </span>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${complaint.location_lat},${complaint.location_lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                    <FiNavigation size={10}/> Directions
                  </a>
                </div>
                {/* Fixed pixel height — never % or auto for Leaflet */}
                <div style={{ height:'220px', width:'100%' }}>
                  <MapContainer
                    center={[complaint.location_lat, complaint.location_lng]}
                    zoom={15}
                    style={{ height:'100%', width:'100%' }}
                    scrollWheelZoom={false}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='© OpenStreetMap'/>
                    <Marker position={[complaint.location_lat, complaint.location_lng]}>
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">{complaint.title}</p>
                          {complaint.location_address && (
                            <p className="text-gray-500 mt-0.5" style={{maxWidth:'180px'}}>
                              {complaint.location_address}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>
            )}

            {/* Case pipeline */}
            <Section>
              <SectionTitle>Case Pipeline</SectionTitle>
              <div className="space-y-2">
                {['submitted','under_review','assigned','in_progress','resolved'].map(step => {
                  const stepMeta = sm(step);
                  const curIdx  = statusOrder.indexOf(complaint.status);
                  const stepIdx = statusOrder.indexOf(step);
                  const done    = curIdx >= stepIdx && complaint.status !== 'rejected';
                  const current = step === complaint.status
                    || (step==='submitted' && complaint.status==='active');
                  return (
                    <div key={step}
                      className={`flex items-center gap-2.5 p-2 rounded-lg text-xs
                        ${current ? `${stepMeta.bg} border ${stepMeta.border}` : done ? 'bg-white/5' : 'opacity-40'}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0
                        ${done ? stepMeta.color.replace('text-','bg-') : 'bg-gray-600'}`}/>
                      <span className={done ? stepMeta.color : 'text-gray-600'}>
                        {stepMeta.label}
                      </span>
                      {current && <span className="ml-auto text-[10px] font-bold opacity-80">← NOW</span>}
                      {done && !current && <FiCheckCircle size={10} className={`ml-auto ${stepMeta.color}`}/>}
                    </div>
                  );
                })}
                {complaint.status === 'rejected' && (
                  <div className="flex items-center gap-2.5 p-2 rounded-lg text-xs bg-red-500/10 border border-red-500/30">
                    <div className="w-2 h-2 rounded-full bg-red-400 shrink-0"/>
                    <span className="text-red-400">Rejected / Closed</span>
                    <span className="ml-auto text-[10px] font-bold text-red-400">← NOW</span>
                  </div>
                )}
              </div>
            </Section>

            {/* Official report download */}
            <Section extra="border border-green-500/15">
              <SectionTitle>Official Report</SectionTitle>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Download a government-style PDF including all case details, history and evidence.
              </p>
              <button onClick={hasPDF}
                className="w-full flex items-center justify-center gap-2 py-2.5
                           bg-green-500/15 border border-green-500/30 text-green-400
                           text-sm font-semibold rounded-xl hover:bg-green-500/25 transition-all">
                <FiDownload size={14}/> Download PDF Report
              </button>
            </Section>

          </div>{/* end right column */}
        </div>{/* end grid */}
      </div>{/* end constrained container */}
    </div>/* end outer wrapper */
  );
};

export default CaseDetailPage;
