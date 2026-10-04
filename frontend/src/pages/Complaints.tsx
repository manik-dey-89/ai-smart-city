/**
 * Complaints.tsx — Universal Complaint System
 * Tabs: New Complaint | My Cases | Case Tracking
 * Features: Map picker, evidence upload, tracking ID, full status timeline
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMessageSquare, FiPlus, FiLoader, FiAlertCircle, FiCheckCircle,
  FiClock, FiAlertTriangle, FiRefreshCw, FiMapPin, FiSearch,
  FiUpload, FiX, FiShield, FiNavigation, FiInfo, FiFileText,
  FiTruck, FiDroplet, FiAlertOctagon, FiEye, FiPhone, FiDownload,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { printCaseReport } from '../utils/caseReport';

/* ── Fix Leaflet icons ──────────────────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface HistoryEntry {
  id: string; action: string;
  old_status?: string; new_status?: string;
  note?: string; actor_username?: string; created_at: string;
}
interface Complaint {
  id: string; type: string; title: string; description: string;
  priority: string; status: string; created_at: string;
  location_lat?: number | null; location_lng?: number | null;
  location_address?: string | null;
  tracking_id?: string | null; routed_to?: string | null;
  evidence_note?: string | null;
  images: { image_url: string; file_name?: string }[];
}
interface TrackResult {
  tracking_id: string; title: string; type: string;
  priority: string; status: string;
  location_address?: string | null; routed_to?: string | null;
  created_at: string; updated_at?: string | null;
  history: HistoryEntry[]; images_count: number;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const COMPLAINT_TYPES = [
  { value: 'Road Damage / Pothole',     icon: FiTruck,         color: 'text-orange-400' },
  { value: 'Traffic Accident',          icon: FiAlertTriangle, color: 'text-red-400'    },
  { value: 'Garbage / Waste Dumping',   icon: FiAlertOctagon,  color: 'text-yellow-400' },
  { value: 'Waterlogging / Drainage',   icon: FiDroplet,       color: 'text-blue-400'   },
  { value: 'Street Light Issue',        icon: FiAlertCircle,   color: 'text-yellow-300' },
  { value: 'Theft / Robbery',           icon: FiShield,        color: 'text-purple-400' },
  { value: 'Assault / Criminal Case',   icon: FiShield,        color: 'text-red-500'    },
  { value: 'Illegal Parking',           icon: FiTruck,         color: 'text-orange-300' },
  { value: 'Noise Complaint',           icon: FiAlertCircle,   color: 'text-cyan-400'   },
  { value: 'Water Leak / Pipe Burst',   icon: FiDroplet,       color: 'text-blue-300'   },
  { value: 'Sewage / Sanitation Issue', icon: FiAlertOctagon,  color: 'text-green-400'  },
  { value: 'Fire Hazard',               icon: FiAlertTriangle, color: 'text-red-400'    },
  { value: 'Medical Emergency',         icon: FiAlertOctagon,  color: 'text-red-300'    },
  { value: 'Encroachment',              icon: FiMapPin,        color: 'text-yellow-500' },
  { value: 'Other / General Complaint', icon: FiMessageSquare, color: 'text-gray-400'   },
];

const STATUS_META: Record<string,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  submitted:    {label:'Submitted',           color:'text-yellow-400', bg:'bg-yellow-500/10',icon:FiClock},
  active:       {label:'Submitted',           color:'text-yellow-400', bg:'bg-yellow-500/10',icon:FiClock},
  under_review: {label:'Under Review',        color:'text-blue-400',   bg:'bg-blue-500/10',  icon:FiEye},
  assigned:     {label:'Assigned to Officer', color:'text-purple-400', bg:'bg-purple-500/10',icon:FiNavigation},
  in_progress:  {label:'In Progress',         color:'text-cyan-400',   bg:'bg-cyan-500/10',  icon:FiLoader},
  resolved:     {label:'Resolved',            color:'text-green-400',  bg:'bg-green-500/10', icon:FiCheckCircle},
  rejected:     {label:'Rejected',            color:'text-red-400',    bg:'bg-red-500/10',   icon:FiX},
};

const ROUTE_LABELS: Record<string,string> = {
  police:'Police Department', traffic_officer:'Traffic Management',
  fire_service:'Fire Service', emergency:'Emergency Response',
  municipal:'Municipal / Civic Dept',
};

const sm = (s: string) => STATUS_META[s] ?? {
  label: s.replace(/_/g,' '), color:'text-gray-400', bg:'bg-gray-500/10', icon:FiInfo,
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString([],{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  catch { return iso; }
}
function priorityColor(p: string) {
  return p==='high'?'text-red-400':p==='medium'?'text-yellow-400':'text-green-400';
}

/* ── Nearby Help Center ──────────────────────────────────────────────────────── */
interface NearbyFacility {
  name: string;
  type: string;
  distance: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
}

function _categoryForType(complaintType: string): 'police'|'fire'|'medical'|'municipal' {
  const t = complaintType.toLowerCase();
  if (t.includes('theft')||t.includes('assault')||t.includes('criminal')||t.includes('robbery')||t.includes('murder')) return 'police';
  if (t.includes('fire')||t.includes('explosion')||t.includes('gas')) return 'fire';
  if (t.includes('medical')||t.includes('accident')||t.includes('ambulance')) return 'medical';
  return 'municipal';
}

async function fetchNearbyFacilities(
  lat: number, lng: number, category: 'police'|'fire'|'medical'|'municipal'
): Promise<NearbyFacility[]> {
  const amenityMap: Record<string, string> = {
    police:   'police',
    fire:     'fire_station',
    medical:  'hospital',
    municipal:'government',
  };
  const amenity = amenityMap[category];
  const query = `
[out:json][timeout:12];
node["amenity"="${amenity}"](around:5000,${lat},${lng});
out 5;
`;
  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!resp.ok) return _fallbackFacilities(category);
    const data = await resp.json();
    const elements: any[] = data.elements || [];
    if (!elements.length) return _fallbackFacilities(category);
    return elements.slice(0,3).map((el: any) => {
      const tags = el.tags || {};
      const distKm = _haversineKm(lat, lng, el.lat, el.lon);
      const distStr = distKm < 1 ? `${Math.round(distKm*1000)} m` : `${distKm.toFixed(1)} km`;
      return {
        name:     tags.name || tags['name:en'] || `Nearby ${category.charAt(0).toUpperCase()+category.slice(1)}`,
        type:     amenity.replace('_',' '),
        distance: distStr,
        phone:    tags.phone || tags['contact:phone'] || _defaultPhone(category),
        address:  [tags['addr:street'], tags['addr:city']].filter(Boolean).join(', ') || 'Address not available',
        lat:      el.lat,
        lng:      el.lon,
      };
    });
  } catch {
    return _fallbackFacilities(category);
  }
}

function _haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function _defaultPhone(cat: string): string {
  const m: Record<string, string> = { police:'100', fire:'101', medical:'108', municipal:'1800-11-4000' };
  return m[cat] || '112';
}

function _fallbackFacilities(category: 'police'|'fire'|'medical'|'municipal'): NearbyFacility[] {
  const fallbacks: Record<string, NearbyFacility[]> = {
    police: [
      { name:'Police Control Room', type:'police', distance:'—', phone:'100', address:'Dial 100 for immediate assistance' },
      { name:'Emergency Helpline',  type:'police', distance:'—', phone:'112', address:'All-India emergency number' },
    ],
    fire: [
      { name:'Fire Service Emergency', type:'fire_station', distance:'—', phone:'101', address:'Dial 101 for fire emergencies' },
      { name:'Emergency Helpline',     type:'fire_station', distance:'—', phone:'112', address:'All-India emergency number' },
    ],
    medical: [
      { name:'Medical Emergency',    type:'hospital', distance:'—', phone:'108', address:'Dial 108 for ambulance' },
      { name:'Emergency Helpline',   type:'hospital', distance:'—', phone:'112', address:'All-India emergency number' },
    ],
    municipal: [
      { name:'Municipal Helpline',   type:'government', distance:'—', phone:'1800-11-4000', address:'NMCG toll-free helpline' },
      { name:'Emergency Helpline',   type:'government', distance:'—', phone:'112', address:'All-India emergency number' },
    ],
  };
  return fallbacks[category] || fallbacks.municipal;
}

const CATEGORY_META = {
  police:   { label:'Nearby Police Stations', color:'text-blue-400',   bg:'bg-blue-500/10',   icon: FiShield  },
  fire:     { label:'Nearby Fire Stations',   color:'text-orange-400', bg:'bg-orange-500/10', icon: FiAlertTriangle },
  medical:  { label:'Nearby Hospitals',       color:'text-red-400',    bg:'bg-red-500/10',    icon: FiAlertOctagon  },
  municipal:{ label:'Nearby Support Centers', color:'text-cyan-400',   bg:'bg-cyan-500/10',   icon: FiMapPin  },
};

const NearbyHelp: React.FC<{
  complaintType: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
}> = ({ complaintType, lat, lng }) => {
  const [facilities, setFacilities]   = useState<NearbyFacility[]>([]);
  const [loading, setLoading]         = useState(true);
  const [category, setCategory]       = useState<'police'|'fire'|'medical'|'municipal'>('municipal');

  useEffect(() => {
    const cat = _categoryForType(complaintType);
    setCategory(cat);
    setLoading(true);
    if (lat && lng) {
      fetchNearbyFacilities(lat, lng, cat)
        .then(setFacilities)
        .finally(() => setLoading(false));
    } else {
      setFacilities(_fallbackFacilities(cat));
      setLoading(false);
    }
  }, [complaintType, lat, lng]);

  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
      className={`glass-card p-5 border ${meta.bg.replace('/10','/20')} border-opacity-40`}
      style={{ borderColor: meta.color.replace('text-','').includes('blue') ? 'rgba(59,130,246,0.25)'
               : meta.color.includes('orange') ? 'rgba(249,115,22,0.25)'
               : meta.color.includes('red') ? 'rgba(239,68,68,0.25)' : 'rgba(6,182,212,0.25)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${meta.bg}`}>
          <Icon size={15} className={meta.color} />
        </div>
        <div>
          <h3 className={`text-sm font-bold ${meta.color}`}>{meta.label}</h3>
          <p className="text-[10px] text-gray-500">
            {lat && lng ? 'Based on your selected location' : 'National helpline numbers'}
          </p>
        </div>
        {loading && <FiLoader size={13} className="animate-spin text-gray-500 ml-auto" />}
      </div>

      <div className="space-y-3">
        {facilities.map((f, i) => (
          <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1*i }}
            className="flex items-start justify-between gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{f.name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{f.address}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs">
                {f.distance !== '—' && (
                  <span className="flex items-center gap-1 text-gray-400">
                    <FiMapPin size={9}/> {f.distance}
                  </span>
                )}
                <span className="flex items-center gap-1 text-gray-400">
                  <FiPhone size={9}/> {f.phone}
                </span>
              </div>
            </div>
            <a href={`tel:${f.phone}`}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                         transition-all ${meta.bg} ${meta.color} border border-white/10 hover:border-white/20`}>
              <FiPhone size={11}/> Call
            </a>
          </motion.div>
        ))}
      </div>

      <p className="text-[10px] text-gray-700 mt-3">
        Locations sourced from OpenStreetMap via Overpass API · Always verify before dialling
      </p>
    </motion.div>
  );
};

/* ── Map picker sub-component ────────────────────────────────────────────────── */
const MapPicker: React.FC<{
  lat: number; lng: number;
  onPick: (lat:number, lng:number, address:string)=>void;
}> = ({lat, lng, onPick}) => {
  const ClickHandler = () => {
    useMapEvents({
      click: async (e) => {
        const {lat:nlat, lng:nlng} = e.latlng;
        // Reverse geocode
        let addr = `${nlat.toFixed(5)}, ${nlng.toFixed(5)}`;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${nlat}&lon=${nlng}&format=json`,
            {headers:{'User-Agent':'SmartCityDashboard/1.0'}}
          );
          const j = await r.json();
          if (j.display_name) addr = j.display_name;
        } catch { /* use coords */ }
        onPick(nlat, nlng, addr);
      },
    });
    return null;
  };
  return (
    <MapContainer center={[lat, lng]} zoom={13}
      style={{height:'100%', width:'100%'}} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap'/>
      <ClickHandler/>
      <Marker position={[lat, lng]}/>
    </MapContainer>
  );
};

/* ── Status timeline ─────────────────────────────────────────────────────────── */
const Timeline: React.FC<{history: HistoryEntry[]}> = ({history}) => (
  <div className="space-y-0">
    {history.map((h, i) => {
      const isLast = i === history.length - 1;
      const meta = sm(h.new_status || h.action);
      const Icon = meta.icon;
      return (
        <div key={h.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg} border border-white/10`}>
              <Icon size={12} className={meta.color}/>
            </div>
            {!isLast && <div className="w-px flex-1 bg-white/10 my-1"/>}
          </div>
          <div className={`pb-4 ${isLast?'':'pb-4'}`}>
            <p className={`text-xs font-semibold ${meta.color} capitalize`}>
              {h.action.replace(/_/g,' ')}
              {h.new_status && h.new_status !== h.action &&
                <span className="text-gray-500 font-normal"> → {h.new_status.replace(/_/g,' ')}</span>}
            </p>
            {h.note && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{h.note}</p>}
            <p className="text-[10px] text-gray-600 mt-0.5">
              {h.actor_username && <span>{h.actor_username} · </span>}
              {fmtDate(h.created_at)}
            </p>
          </div>
        </div>
      );
    })}
  </div>
);

/* ══ Main Component ═══════════════════════════════════════════════════════════ */
const Complaints: React.FC = () => {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'new'|'my'|'track'>('new');

  /* ── NEW COMPLAINT state ─────────────────────────────────────── */
  const [form, setForm] = useState({
    type: COMPLAINT_TYPES[0].value,
    title: '', description: '', priority: 'medium',
    location_address: '', evidence_note: '',
    location_lat: 22.5726, location_lng: 88.3639,
  });
  const [locationPicked, setLocationPicked] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<{name:string;data:string;type:string}[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]     = useState<Complaint|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── MY CASES state ──────────────────────────────────────────── */
  const [cases, setCases]         = useState<Complaint[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError]     = useState('');
  const [expandedCase, setExpandedCase] = useState<string|null>(null);

  /* ── TRACKING state ──────────────────────────────────────────── */
  const [trackId, setTrackId]     = useState('');
  const [tracking, setTracking]   = useState(false);
  const [trackResult, setTrackResult] = useState<TrackResult|null>(null);
  const [trackError, setTrackError]   = useState('');

  /* ── Load cases ──────────────────────────────────────────────── */
  const loadCases = useCallback(async () => {
    setCasesLoading(true); setCasesError('');
    try {
      const res = await authFetch('/api/complaints');
      if (!res.ok) { setCasesError('Failed to load cases'); return; }
      setCases(await res.json());
    } catch { setCasesError('Network error'); }
    finally { setCasesLoading(false); }
  }, [authFetch]);

  useEffect(() => { if (tab === 'my') loadCases(); }, [tab, loadCases]);

  /* ── GPS location ────────────────────────────────────────────── */
  const useGPS = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const {latitude, longitude} = pos.coords;
      let addr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          {headers:{'User-Agent':'SmartCityDashboard/1.0'}}
        );
        const j = await r.json();
        if (j.display_name) addr = j.display_name;
      } catch { /* use coords */ }
      setForm(f => ({...f, location_lat:latitude, location_lng:longitude, location_address:addr}));
      setLocationPicked(true);
    }, () => alert('Could not get GPS location'));
  };

  /* ── File evidence ───────────────────────────────────────────── */
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (evidenceFiles.length + files.length > 5) {
      alert('Maximum 5 files allowed'); return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setEvidenceFiles(prev => [...prev, {
          name: file.name,
          data: ev.target?.result as string,
          type: file.type,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  /* ── Submit complaint ────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setSubmitError('Title and description are required.'); return;
    }
    setSubmitting(true); setSubmitError('');
    try {
      const res = await authFetch('/api/complaints', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          type: form.type, title: form.title.trim(),
          description: form.description.trim(), priority: form.priority,
          location_lat: locationPicked ? form.location_lat : null,
          location_lng: locationPicked ? form.location_lng : null,
          location_address: form.location_address || null,
          evidence_note: form.evidence_note || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSubmitError(j.detail || 'Submission failed'); return;
      }
      const created: Complaint = await res.json();
      // Upload evidence images
      for (const f of evidenceFiles) {
        await authFetch(`/api/complaints/${created.id}/images`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({data: f.data, file_name: f.name, file_type: f.type}),
        }).catch(() => {});
      }
      setSubmitted(created);
      setForm({type:COMPLAINT_TYPES[0].value, title:'', description:'', priority:'medium',
               location_address:'', evidence_note:'', location_lat:22.5726, location_lng:88.3639});
      setLocationPicked(false); setEvidenceFiles([]);
    } catch { setSubmitError('Network error — could not submit.'); }
    finally { setSubmitting(false); }
  };

  /* ── Track complaint ─────────────────────────────────────────── */
  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackId.trim()) return;
    setTracking(true); setTrackError(''); setTrackResult(null);
    try {
      const res = await authFetch(`/api/complaints/track/${trackId.trim().toUpperCase()}`);
      if (!res.ok) {
        const j = await res.json().catch(()=>({}));
        setTrackError(j.detail || 'Case not found'); return;
      }
      setTrackResult(await res.json());
    } catch { setTrackError('Network error'); }
    finally { setTracking(false); }
  };

  /* ── Stats ────────────────────────────────────────────────────── */
  const stats = {
    total:    cases.length,
    pending:  cases.filter(c=>['submitted','active','under_review'].includes(c.status)).length,
    active:   cases.filter(c=>['assigned','in_progress'].includes(c.status)).length,
    resolved: cases.filter(c=>c.status==='resolved').length,
  };

  const inputCls = `w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white
                    text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-all`;
  const labelCls = `block text-xs text-gray-400 font-medium mb-1.5`;

  return (
    <div className="space-y-5 pb-6 relative min-h-screen">

      {/* ── Full-page background ── */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10 pointer-events-none"
        style={{ backgroundImage: "url('/backgrounds/complaint_background.png')" }}
      />
      {/* Dark overlay so text stays readable */}
      <div className="fixed inset-0 bg-[#0a0f1e]/80 -z-10 pointer-events-none" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <FiMessageSquare size={22} className="text-cyan-400"/> Complaint Centre
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Report civic issues · Track your case · Citizen: {user?.full_name || user?.username}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit">
        {([
          {id:'new',   label:'New Complaint', icon:FiPlus},
          {id:'my',    label:'My Cases',      icon:FiFileText},
          {id:'track', label:'Case Tracking', icon:FiSearch},
        ] as const).map(({id, label, icon:Icon}) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab===id?'bg-cyan-500 text-black':'text-gray-400 hover:text-white'}`}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════ TAB: NEW COMPLAINT ══════════════════════ */}
      {tab === 'new' && (
        <AnimatePresence mode="wait">
          {submitted ? (
            /* Confirmation screen */
            <motion.div key="confirm" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              className="space-y-4">
              <div className="glass-card p-6 border border-green-500/30 text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <FiCheckCircle size={28} className="text-green-400"/>
                </div>
                <h2 className="text-xl font-extrabold text-green-400">Complaint Submitted!</h2>
                <p className="text-gray-400 text-sm mt-1">Your case has been registered successfully.</p>
              </div>

              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Case Tracking ID</p>
                  <button onClick={()=>{
                    navigator.clipboard.writeText(submitted.tracking_id||'');
                  }} className="text-xs text-cyan-400 hover:underline">Copy</button>
                </div>
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-extrabold text-cyan-400 tracking-widest font-mono">
                    {submitted.tracking_id}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Save this ID to track your complaint</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    {label:'Title',    val:submitted.title},
                    {label:'Type',     val:submitted.type},
                    {label:'Priority', val:submitted.priority},
                    {label:'Status',   val:sm(submitted.status).label},
                    {label:'Location', val:submitted.location_address || 'Not specified'},
                    {label:'Evidence', val:evidenceFiles.length>0?`${evidenceFiles.length} file(s)`:'None'},
                    {label:'Submitted',val:fmtDate(submitted.created_at)},
                  ].map(({label,val})=>(
                    <div key={label} className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm text-white font-medium mt-0.5 truncate">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Nearby Help Center — auto-shown after submission */}
                <NearbyHelp
                  complaintType={submitted.type}
                  lat={submitted.location_lat}
                  lng={submitted.location_lng}
                />

                {/* Legal disclaimer */}
                <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                  <p className="text-xs font-semibold text-yellow-400 mb-1.5 flex items-center gap-1.5">
                    <FiShield size={12}/> Important Notice
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Knowingly submitting a false, fabricated, or misleading complaint may constitute an
                    offence under applicable Indian law, including provisions of the Bharatiya Nyaya Sanhita
                    (BNS) relating to false information and offences against public justice.
                    The Smart City Administration reserves the right to take appropriate legal action
                    against misuse of this system.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button onClick={()=>{setSubmitted(null);}}
                    className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black
                               font-semibold rounded-xl text-sm transition-all">
                    Submit Another
                  </button>
                  <button
                    onClick={()=>printCaseReport(submitted as any, true)}
                    className="flex-1 py-2.5 bg-green-500/15 hover:bg-green-500/25 text-green-400
                               rounded-xl text-sm font-semibold transition-all border border-green-500/30
                               flex items-center justify-center gap-2">
                    <FiDownload size={13}/> PDF Report
                  </button>
                  <button onClick={()=>{
                    navigate(`/case/${submitted.id}`);
                  }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300
                               rounded-xl text-sm transition-all border border-white/10
                               flex items-center justify-center gap-2">
                    <FiEye size={13}/> View Full Case
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Complaint form */
            <motion.form key="form" onSubmit={handleSubmit}
              initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              className="space-y-5">

              {/* Error */}
              <AnimatePresence>
                {submitError && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    <FiAlertCircle size={14}/> {submitError}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Left column */}
                <div className="space-y-4">
                  {/* Complaint type grid */}
                  <div>
                    <label className={labelCls}>Complaint Type *</label>
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {COMPLAINT_TYPES.map(t => {
                        const Icon = t.icon;
                        const active = form.type === t.value;
                        return (
                          <button type="button" key={t.value}
                            onClick={() => setForm(f=>({...f,type:t.value}))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                                        font-medium transition-all text-left
                                        ${active
                                          ?'bg-cyan-500/15 border-cyan-500/50 text-white'
                                          :'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                            <Icon size={13} className={active?'text-cyan-400':t.color}/>
                            <span className="truncate">{t.value}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className={labelCls}>Priority *</label>
                    <div className="flex gap-2">
                      {['low','medium','high'].map(p=>(
                        <button type="button" key={p} onClick={()=>setForm(f=>({...f,priority:p}))}
                          className={`flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition-all
                            ${form.priority===p
                              ?p==='high'  ?'bg-red-500/20 border-red-500/50 text-red-400'
                               :p==='medium'?'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                               :'bg-green-500/20 border-green-500/50 text-green-400'
                              :'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className={labelCls}>Complaint Title *</label>
                    <input type="text" value={form.title}
                      onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                      placeholder="Brief summary of the issue"
                      className={inputCls} required/>
                  </div>

                  {/* Description */}
                  <div>
                    <label className={labelCls}>Detailed Description *</label>
                    <textarea value={form.description}
                      onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                      placeholder="Describe the issue in detail — what happened, when, how severe, who is affected..."
                      rows={4} className={`${inputCls} resize-none`} required/>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  {/* Location map picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`${labelCls} mb-0`}>Location (tap map to set)</label>
                      <button type="button" onClick={useGPS}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                        <FiNavigation size={11}/> Use GPS
                      </button>
                    </div>
                    <div className="h-52 rounded-xl overflow-hidden border border-white/10">
                      <MapPicker
                        lat={form.location_lat} lng={form.location_lng}
                        onPick={(lat,lng,addr) => {
                          setForm(f=>({...f,location_lat:lat,location_lng:lng,location_address:addr}));
                          setLocationPicked(true);
                        }}
                      />
                    </div>
                    <div className={`mt-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg
                      ${locationPicked?'text-cyan-400 bg-cyan-500/10':'text-gray-500 bg-white/5'}`}>
                      <FiMapPin size={11}/>
                      <span className="truncate">{
                        locationPicked ? form.location_address : 'No location selected — tap map or use GPS'
                      }</span>
                    </div>
                    {locationPicked && (
                      <input type="text" value={form.location_address}
                        onChange={e=>setForm(f=>({...f,location_address:e.target.value}))}
                        placeholder="Edit address if needed"
                        className={`${inputCls} mt-2 text-xs`}/>
                    )}
                  </div>

                  {/* Evidence upload panel */}
                  <div className="glass-card p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <FiUpload size={12} className="text-cyan-400"/> Evidence Panel
                        <span className="text-gray-500 font-normal">(Optional)</span>
                      </p>
                      {evidenceFiles.length < 5 && (
                        <button type="button" onClick={()=>fileInputRef.current?.click()}
                          className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                          <FiPlus size={11}/> Add File
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx"
                      multiple onChange={onFileChange}/>

                    {evidenceFiles.length === 0 ? (
                      <button type="button" onClick={()=>fileInputRef.current?.click()}
                        className="w-full border border-dashed border-white/10 rounded-xl py-6 text-center
                                   text-gray-600 text-xs hover:border-cyan-500/30 transition-all">
                        <FiUpload size={20} className="mx-auto mb-2 opacity-40"/>
                        Click to upload photos, videos or documents<br/>
                        <span className="opacity-60">Max 5 files · Images, Videos, PDF</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        {evidenceFiles.map((f,i)=>(
                          <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                            <FiFileText size={12} className="text-cyan-400 shrink-0"/>
                            <span className="text-xs text-gray-300 truncate flex-1">{f.name}</span>
                            <button type="button" onClick={()=>setEvidenceFiles(p=>p.filter((_,j)=>j!==i))}
                              className="text-gray-600 hover:text-red-400 transition-colors">
                              <FiX size={12}/>
                            </button>
                          </div>
                        ))}
                        {evidenceFiles.length < 5 && (
                          <button type="button" onClick={()=>fileInputRef.current?.click()}
                            className="w-full text-xs text-gray-600 hover:text-cyan-400 py-1 transition-all">
                            + Add more
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                      🔒 All evidence and personal data is kept strictly confidential.
                      Evidence will not be publicly published or shared without proper legal authorization.
                    </p>

                    <div className="mt-3">
                      <label className={`${labelCls} text-[10px]`}>Evidence Note (optional)</label>
                      <textarea value={form.evidence_note}
                        onChange={e=>setForm(f=>({...f,evidence_note:e.target.value}))}
                        placeholder="Briefly describe what the evidence shows..."
                        rows={2} className={`${inputCls} text-xs resize-none`}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal notice before submit */}
              <div className="p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
                <p className="text-xs text-yellow-400/80 leading-relaxed flex items-start gap-1.5">
                  <FiShield size={11} className="shrink-0 mt-0.5"/>
                  By submitting, you confirm this complaint is truthful. Submitting false information
                  may attract legal liability under applicable Indian law.
                </p>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40
                           text-black font-bold rounded-xl text-sm transition-all
                           flex items-center justify-center gap-2">
                {submitting
                  ? <><FiLoader size={15} className="animate-spin"/> Submitting…</>
                  : <><FiPlus size={15}/> Submit Complaint</>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      )}

      {/* ══════════════════ TAB: MY CASES ════════════════════════════ */}
      {tab === 'my' && (
        <motion.div key="my" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
          className="space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {label:'Total',     val:stats.total,    color:'text-white'        },
              {label:'Pending',   val:stats.pending,  color:'text-yellow-400'   },
              {label:'Active',    val:stats.active,   color:'text-cyan-400'     },
              {label:'Resolved',  val:stats.resolved, color:'text-green-400'    },
            ].map(({label,val,color})=>(
              <div key={label} className="glass-card p-4">
                <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={loadCases} disabled={casesLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10
                         rounded-xl text-xs text-gray-400 hover:text-white transition-all">
              <FiRefreshCw size={13} className={casesLoading?'animate-spin':''}/> Refresh
            </button>
          </div>

          {casesError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <FiAlertCircle size={14}/> {casesError}
            </div>
          )}
          {casesLoading && (
            <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
              <FiLoader size={22} className="animate-spin text-cyan-400"/>
              <span>Loading your cases…</span>
            </div>
          )}
          {!casesLoading && cases.length === 0 && (
            <div className="glass-card p-12 text-center text-gray-500">
              <FiMessageSquare size={36} className="mx-auto mb-3 text-gray-600"/>
              <p className="font-medium">No complaints submitted yet.</p>
            </div>
          )}

          {!casesLoading && cases.map((c, i) => {
            const meta = sm(c.status);
            const Icon = meta.icon;
            const isExpanded = expandedCase === c.id;
            return (
              <motion.div key={c.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                transition={{delay:i*0.03}}
                className="glass-card overflow-hidden">
                <button type="button" onClick={()=>setExpandedCase(isExpanded?null:c.id)}
                  className="w-full p-5 text-left hover:bg-white/3 transition-all">
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
                      <p className="text-sm text-gray-400 line-clamp-1">{c.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-600">
                        {c.tracking_id && (
                          <span className="font-mono text-cyan-600">{c.tracking_id}</span>
                        )}
                        {c.location_address && (
                          <span className="flex items-center gap-1">
                            <FiMapPin size={10}/> {c.location_address.split(',')[0]}
                          </span>
                        )}
                        <span>{fmtDate(c.created_at)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${meta.bg} ${meta.color}`}>
                        <Icon size={11}/> {meta.label}
                      </span>
                      {c.routed_to && (
                        <span className="text-[10px] text-gray-500">
                          → {ROUTE_LABELS[c.routed_to] || c.routed_to}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                    <p className="text-sm text-gray-300 leading-relaxed">{c.description}</p>
                    {c.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {c.images.map((img,j)=>(
                          <div key={j} className="w-16 h-16 rounded-lg bg-white/5 overflow-hidden
                                                   border border-white/10 flex items-center justify-center">
                            {img.image_url.startsWith('data:image') ? (
                              <img src={img.image_url} alt="evidence"
                                className="w-full h-full object-cover"/>
                            ) : (
                              <FiFileText size={20} className="text-gray-500"/>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ══════════════════ TAB: CASE TRACKING ═══════════════════════ */}
      {tab === 'track' && (
        <motion.div key="track" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
          className="space-y-5">

          {/* Search */}
          <form onSubmit={handleTrack} className="glass-card p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <FiSearch size={16} className="text-cyan-400"/> Track Your Case
            </h2>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                <input type="text" value={trackId}
                  onChange={e=>setTrackId(e.target.value.toUpperCase())}
                  placeholder="Enter Tracking ID e.g. CMP-2024-123456"
                  className={`${inputCls} pl-9 font-mono uppercase`}/>
              </div>
              <button type="submit" disabled={tracking||!trackId.trim()}
                className="px-5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/30
                           text-black font-semibold rounded-xl text-sm transition-all flex items-center gap-2">
                {tracking?<FiLoader size={14} className="animate-spin"/>:<FiSearch size={14}/>}
                Track
              </button>
            </div>
            {trackError && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                <FiAlertCircle size={12}/> {trackError}
              </p>
            )}
          </form>

          {trackResult && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
              className="space-y-4">
              {/* Case header */}
              <div className={`glass-card p-5 border ${sm(trackResult.status).bg.replace('bg-','border-').replace('/10','/30')}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 font-mono mb-1">{trackResult.tracking_id}</p>
                    <h2 className="text-lg font-bold text-white">{trackResult.title}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">{trackResult.type}</p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const m = sm(trackResult.status);
                      const Ic = m.icon;
                      return (
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${m.bg} ${m.color}`}>
                          <Ic size={14}/> {m.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    {label:'Priority',   val:trackResult.priority},
                    {label:'Filed',      val:fmtDate(trackResult.created_at)},
                    {label:'Location',   val:trackResult.location_address?.split(',')[0]||'Not specified'},
                    {label:'Department', val:ROUTE_LABELS[trackResult.routed_to||'']||trackResult.routed_to||'Pending Review'},
                  ].map(({label,val})=>(
                    <div key={label} className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5 truncate">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status pipeline */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <FiClock size={14} className="text-cyan-400"/> Case Status Pipeline
                </h3>
                <div className="flex items-center gap-0 overflow-x-auto pb-2">
                  {['submitted','under_review','assigned','in_progress','resolved'].map((s, i, arr) => {
                    const m = sm(s);
                    const Ic = m.icon;
                    const statuses = ['submitted','active','under_review','assigned','in_progress','resolved','rejected'];
                    const curIdx = statuses.indexOf(trackResult.status);
                    const stepIdx = statuses.indexOf(s);
                    const done = curIdx >= stepIdx && trackResult.status !== 'rejected';
                    const current = trackResult.status === s || (s==='submitted' && trackResult.status==='active');
                    return (
                      <React.Fragment key={s}>
                        <div className="flex flex-col items-center gap-1 min-w-[70px]">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                            ${done?`${m.bg} ${m.color.replace('text-','border-').replace('400','500')}`:'bg-white/5 border-white/10 text-gray-600'}
                            ${current?'ring-2 ring-offset-2 ring-offset-[#0f172a] ring-cyan-500/50':''}`}>
                            <Ic size={13}/>
                          </div>
                          <p className={`text-[10px] text-center leading-tight ${done?m.color:'text-gray-600'}`}>
                            {m.label}
                          </p>
                        </div>
                        {i < arr.length - 1 && (
                          <div className={`h-0.5 flex-1 min-w-[20px] mx-1 rounded transition-all
                            ${done && curIdx > stepIdx?'bg-cyan-500/50':'bg-white/10'}`}/>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {trackResult.status === 'rejected' && (
                    <>
                      <div className="h-0.5 flex-1 min-w-[20px] mx-1 bg-red-500/30 rounded"/>
                      <div className="flex flex-col items-center gap-1 min-w-[70px]">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center
                                        bg-red-500/10 border-2 border-red-500/40 text-red-400">
                          <FiX size={13}/>
                        </div>
                        <p className="text-[10px] text-red-400 text-center">Rejected</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Timeline */}
              {trackResult.history.length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <FiFileText size={14} className="text-yellow-400"/> Activity History
                  </h3>
                  <Timeline history={[...trackResult.history].reverse()}/>
                </div>
              )}

              {/* Images count */}
              {trackResult.images_count > 0 && (
                <div className="glass-card p-4 flex items-center gap-3">
                  <FiUpload size={16} className="text-cyan-400"/>
                  <p className="text-sm text-gray-300">
                    {trackResult.images_count} evidence file{trackResult.images_count>1?'s':''} attached to this case.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default Complaints;
