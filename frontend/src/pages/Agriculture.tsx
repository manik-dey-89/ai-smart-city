/**
 * Agriculture.tsx — AgriHub Smart Farming Portal
 * Features: Crop Management, Market Prices, Marketplace, Govt Schemes, Expert Q&A, Crop Recommender
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiRefreshCw, FiLoader, FiAlertCircle,
  FiCheckCircle, FiX, FiSearch,
  FiMessageSquare, FiThermometer,
  FiTrash2, FiInfo,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

/* ── Types ───────────────────────────────────────────────────────────────────── */
interface Crop {
  id:string; crop_name:string; variety?:string; area_hectares?:number;
  growth_stage?:string; status:string; sowing_date?:string;
  expected_harvest?:string; soil_type?:string; irrigation_type?:string;
  notes?:string; created_at:string;
}
interface Listing {
  id:string; crop_name:string; variety?:string; quantity_kg:number;
  price_per_kg:number; unit:string; location?:string; description?:string;
  is_organic:boolean; status:string; created_at:string;
  farmer_username?:string; farmer_full_name?:string;
}
interface Price {
  crop:string; variety:string; min:number; max:number; modal:number;
  unit:string; market:string; state:string;
}
interface Scheme {
  id:string; title:string; description:string; category?:string;
  eligibility?:string; benefits?:string; apply_url?:string; deadline?:string;
}
interface Query {
  id:string; title:string; description:string; category?:string;
  is_answered:boolean; answer?:string; answered_at?:string;
  created_at:string; farmer_username?:string;
}

interface RecResult {
  recommendations: {crop:string;suitability:string;reason:string}[];
  note?: string;
}
const TABS = [
  {id:'dashboard', label:'🌾 Dashboard',     icon:'🌾'},
  {id:'crops',     label:'🌱 My Crops',      icon:'🌱'},
  {id:'market',    label:'🛒 Marketplace',   icon:'🛒'},
  {id:'prices',    label:'📊 Mandi Prices',  icon:'📊'},
  {id:'schemes',   label:'🏛 Govt Schemes',  icon:'🏛'},
  {id:'qa',        label:'💬 Expert Q&A',    icon:'💬'},
  {id:'recommend', label:'🤖 Crop AI',       icon:'🤖'},
] as const;

type TabId = typeof TABS[number]['id'];

const GROWTH_STAGES=['Sowing','Germination','Vegetative','Flowering','Grain Filling','Harvesting','Harvested'];
const SOIL_TYPES=['Alluvial','Black Cotton','Red Laterite','Sandy Loam','Clay','Loamy','Silty'];
const IRRIGATION=['Drip','Sprinkler','Flood/Canal','Rainfed','Borewell','Tube Well'];
const SEASONS=['Kharif (Monsoon)','Rabi (Winter)','Zaid (Summer)'];
const RAINFALLS=['High (>1000mm)','Moderate (600-1000mm)','Low (300-600mm)','Arid (<300mm)'];
const QUERY_CATS=['Pest & Disease','Soil Health','Weather Impact','Market Prices','Fertilizers','Irrigation','Seeds','Other'];
const SCHEME_CATS=['Subsidy','Insurance','Loan','Market','Advisory','All'];

const stageColor=(s:string)=>{
  const m:Record<string,string>={
    Sowing:'text-yellow-400',Germination:'text-lime-400',Vegetative:'text-green-400',
    Flowering:'text-pink-400','Grain Filling':'text-orange-400',
    Harvesting:'text-cyan-400',Harvested:'text-gray-400',
  };
  return m[s]||'text-gray-400';
};

function fmtDate(iso:string){
  try{return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
  catch{return iso;}
}

const inputCls=`w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-all`;
const selectCls=`w-full bg-[#0d1b2a] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500/50 transition-all`;

/* ── Add Crop Modal ──────────────────────────────────────────────────────────── */
const AddCropModal: React.FC<{
  onClose:()=>void; onCreated:(c:Crop)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({onClose,onCreated,authFetch}) => {
  const [form,setForm]=useState({crop_name:'',variety:'',area_hectares:'',sowing_date:'',expected_harvest:'',growth_stage:'Sowing',soil_type:'',irrigation_type:'',notes:''});
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');

  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setSaving(true);setError('');
    try{
      const r=await authFetch('/api/agri/crops',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,area_hectares:form.area_hectares?parseFloat(form.area_hectares):null})});
      if(!r.ok){setError((await r.json().catch(()=>({}))).detail||'Failed');return;}
      onCreated(await r.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.form initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
        onSubmit={save} className="w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-white text-lg flex items-center gap-2">🌱 Add New Crop</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={18}/></button>
        </div>
        {error&&<div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1.5">Crop Name *</label>
              <input value={form.crop_name} onChange={e=>setForm({...form,crop_name:e.target.value})} className={inputCls} placeholder="e.g. Rice, Wheat" required/></div>
            <div><label className="block text-xs text-gray-400 mb-1.5">Variety</label>
              <input value={form.variety} onChange={e=>setForm({...form,variety:e.target.value})} className={inputCls} placeholder="e.g. Basmati"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1.5">Area (Hectares)</label>
              <input type="number" step="0.01" value={form.area_hectares} onChange={e=>setForm({...form,area_hectares:e.target.value})} className={inputCls} placeholder="e.g. 2.5"/></div>
            <div><label className="block text-xs text-gray-400 mb-1.5">Growth Stage</label>
              <select value={form.growth_stage} onChange={e=>setForm({...form,growth_stage:e.target.value})} className={selectCls}>
                {GROWTH_STAGES.map(s=><option key={s} value={s} className="bg-gray-900">{s}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1.5">Sowing Date</label>
              <input type="date" value={form.sowing_date} onChange={e=>setForm({...form,sowing_date:e.target.value})} className={inputCls}/></div>
            <div><label className="block text-xs text-gray-400 mb-1.5">Expected Harvest</label>
              <input type="date" value={form.expected_harvest} onChange={e=>setForm({...form,expected_harvest:e.target.value})} className={inputCls}/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1.5">Soil Type</label>
              <select value={form.soil_type} onChange={e=>setForm({...form,soil_type:e.target.value})} className={selectCls}>
                <option value="">Select soil</option>
                {SOIL_TYPES.map(s=><option key={s} value={s} className="bg-gray-900">{s}</option>)}
              </select></div>
            <div><label className="block text-xs text-gray-400 mb-1.5">Irrigation</label>
              <select value={form.irrigation_type} onChange={e=>setForm({...form,irrigation_type:e.target.value})} className={selectCls}>
                <option value="">Select irrigation</option>
                {IRRIGATION.map(s=><option key={s} value={s} className="bg-gray-900">{s}</option>)}
              </select></div>
          </div>
          <div><label className="block text-xs text-gray-400 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}
              className={`${inputCls} resize-none`} placeholder="Any observations or notes…"/></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-green-500/40 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiPlus size={14}/>}
            {saving?'Adding…':'Add Crop'}
          </button>
          <button type="button" onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm">Cancel</button>
        </div>
      </motion.form>
    </div>
  );
};

/* ── Add Listing Modal ───────────────────────────────────────────────────────── */
const AddListingModal: React.FC<{
  onClose:()=>void; onCreated:(l:Listing)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({onClose,onCreated,authFetch}) => {
  const [form,setForm]=useState({crop_name:'',variety:'',quantity_kg:'',price_per_kg:'',unit:'kg',location:'',description:'',is_organic:false});
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setSaving(true);setError('');
    try{
      const r=await authFetch('/api/agri/market',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,quantity_kg:parseFloat(form.quantity_kg),price_per_kg:parseFloat(form.price_per_kg)})});
      if(!r.ok){setError((await r.json().catch(()=>({}))).detail||'Failed');return;}
      onCreated(await r.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.form initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
        onSubmit={save} className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-white text-lg">🛒 List Crop for Sale</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={18}/></button>
        </div>
        {error&&<div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1.5">Crop Name *</label>
              <input value={form.crop_name} onChange={e=>setForm({...form,crop_name:e.target.value})} className={inputCls} required placeholder="e.g. Tomato"/></div>
            <div><label className="block text-xs text-gray-400 mb-1.5">Variety</label>
              <input value={form.variety} onChange={e=>setForm({...form,variety:e.target.value})} className={inputCls} placeholder="e.g. Hybrid"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-400 mb-1.5">Quantity (kg) *</label>
              <input type="number" step="0.01" value={form.quantity_kg} onChange={e=>setForm({...form,quantity_kg:e.target.value})} className={inputCls} required placeholder="500"/></div>
            <div><label className="block text-xs text-gray-400 mb-1.5">Price per kg (₹) *</label>
              <input type="number" step="0.01" value={form.price_per_kg} onChange={e=>setForm({...form,price_per_kg:e.target.value})} className={inputCls} required placeholder="25"/></div>
          </div>
          <div><label className="block text-xs text-gray-400 mb-1.5">Location</label>
            <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} className={inputCls} placeholder="e.g. Nashik, Maharashtra"/></div>
          <div><label className="block text-xs text-gray-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} className={`${inputCls} resize-none`} placeholder="Fresh, grade A quality…"/></div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_organic} onChange={e=>setForm({...form,is_organic:e.target.checked})} className="w-4 h-4 accent-green-500"/>
            <span className="text-sm text-white">🌿 Organic / Natural Farming</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-green-500/40 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiPlus size={14}/>}
            {saving?'Listing…':'Post Listing'}
          </button>
          <button type="button" onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm">Cancel</button>
        </div>
      </motion.form>
    </div>
  );
};

/* ── Post Query Modal ────────────────────────────────────────────────────────── */
const PostQueryModal: React.FC<{
  onClose:()=>void; onCreated:(q:Query)=>void;
  authFetch:(u:string,o?:RequestInit)=>Promise<Response>;
}> = ({onClose,onCreated,authFetch}) => {
  const [form,setForm]=useState({title:'',description:'',category:'Other'});
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setSaving(true);setError('');
    try{
      const r=await authFetch('/api/agri/queries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      if(!r.ok){setError((await r.json().catch(()=>({}))).detail||'Failed');return;}
      onCreated(await r.json());
    }catch{setError('Network error');}finally{setSaving(false);}
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <motion.form initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
        onSubmit={save} className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{background:'rgba(8,16,32,0.97)',border:'1px solid rgba(255,255,255,0.1)'}}
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-white text-lg">💬 Ask an Expert</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white"><FiX size={18}/></button>
        </div>
        {error&&<div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"><FiAlertCircle size={13}/>{error}</div>}
        <div className="space-y-3">
          <div><label className="block text-xs text-gray-400 mb-1.5">Category</label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className={selectCls}>
              {QUERY_CATS.map(c=><option key={c} value={c} className="bg-gray-900">{c}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-400 mb-1.5">Question Title *</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className={inputCls} placeholder="e.g. Yellow leaves on rice crop" required minLength={5}/></div>
          <div><label className="block text-xs text-gray-400 mb-1.5">Describe your problem *</label>
            <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={4}
              className={`${inputCls} resize-none`} required minLength={10}
              placeholder="Describe symptoms, soil type, when it started, what you've tried…"/></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-green-500/40 text-black font-bold py-2.5 rounded-xl text-sm transition-all">
            {saving?<FiLoader size={14} className="animate-spin"/>:<FiMessageSquare size={14}/>}
            {saving?'Posting…':'Post Question'}
          </button>
          <button type="button" onClick={onClose} className="px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm">Cancel</button>
        </div>
      </motion.form>
    </div>
  );
};

/* ══ Main Agriculture Page ══════════════════════════════════════════════════════ */
const Agriculture: React.FC = () => {
  const {authFetch,user} = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Data state
  const [crops,    setCrops]    = useState<Crop[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings,setMyListings]=useState<Listing[]>([]);
  const [prices,   setPrices]   = useState<Price[]>([]);
  const [schemes,  setSchemes]  = useState<Scheme[]>([]);
  const [queries,  setQueries]  = useState<Query[]>([]);

  // Loading states
  const [loadingCrops,    setLoadingCrops]    = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingPrices,   setLoadingPrices]   = useState(false);
  const [loadingSchemes,  setLoadingSchemes]  = useState(false);
  const [loadingQueries,  setLoadingQueries]  = useState(false);

  // Modals
  const [showAddCrop,    setShowAddCrop]    = useState(false);
  const [showAddListing, setShowAddListing] = useState(false);
  const [showPostQuery,  setShowPostQuery]  = useState(false);

  // Filters
  const [priceSearch, setPriceSearch]   = useState('');
  const [schemesCat,  setSchemesCat]    = useState('All');
  const [queryCat,    setQueryCat]      = useState('');
  const [marketSearch,setMarketSearch]  = useState('');

  // Recommender state
  const [recForm, setRecForm] = useState({soil_type:'',state:'',season:'',rainfall:''});
  const [recResult, setRecResult] = useState<RecResult|null>(null);
  const [recLoading, setRecLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const flash=(m:string)=>{setToast(m);setTimeout(()=>setToast(''),3500);};

  const loadCrops = useCallback(async()=>{
    setLoadingCrops(true);
    try{const r=await authFetch('/api/agri/crops');if(r.ok)setCrops(await r.json());}
    catch{}finally{setLoadingCrops(false);}
  },[authFetch]);

  const loadMarket = useCallback(async()=>{
    setLoadingListings(true);
    try{
      const r=await authFetch('/api/agri/market');if(r.ok)setListings(await r.json());
      const r2=await authFetch('/api/agri/market/my');if(r2.ok)setMyListings(await r2.json());
    }catch{}finally{setLoadingListings(false);}
  },[authFetch]);

  const loadPrices = useCallback(async()=>{
    setLoadingPrices(true);
    try{const r=await authFetch('/api/agri/prices');if(r.ok){const d=await r.json();setPrices(d.prices||[]);}}
    catch{}finally{setLoadingPrices(false);}
  },[authFetch]);

  const loadSchemes = useCallback(async()=>{
    setLoadingSchemes(true);
    try{const r=await authFetch('/api/agri/schemes');if(r.ok)setSchemes(await r.json());}
    catch{}finally{setLoadingSchemes(false);}
  },[authFetch]);

  const loadQueries = useCallback(async()=>{
    setLoadingQueries(true);
    try{const r=await authFetch('/api/agri/queries');if(r.ok)setQueries(await r.json());}
    catch{}finally{setLoadingQueries(false);}
  },[authFetch]);

  // Load on tab change
  useEffect(()=>{
    if(activeTab==='dashboard'||activeTab==='crops') loadCrops();
    if(activeTab==='market') loadMarket();
    if(activeTab==='prices') loadPrices();
    if(activeTab==='schemes') loadSchemes();
    if(activeTab==='qa') loadQueries();
  },[activeTab]);

  const deleteCrop = async(id:string)=>{
    await authFetch(`/api/agri/crops/${id}`,{method:'DELETE'});
    setCrops(p=>p.filter(c=>c.id!==id)); flash('Crop removed');
  };

  const deleteListing = async(id:string)=>{
    await authFetch(`/api/agri/market/${id}`,{method:'DELETE'});
    setMyListings(p=>p.filter(l=>l.id!==id)); flash('Listing removed');
  };

  const runRecommender = async()=>{
    if(!recForm.soil_type||!recForm.season){flash('Please select soil type and season');return;}
    setRecLoading(true);setRecResult(null);
    try{
      const r=await authFetch('/api/agri/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(recForm)});
      if(r.ok)setRecResult(await r.json());
    }catch{}finally{setRecLoading(false);}
  };

  const filteredPrices = prices.filter(p=>!priceSearch || p.crop.toLowerCase().includes(priceSearch.toLowerCase())||p.state.toLowerCase().includes(priceSearch.toLowerCase()));
  const filteredSchemes = schemes.filter(s=>schemesCat==='All'||s.category===schemesCat);
  const filteredQueries = queries.filter(q=>!queryCat||q.category===queryCat);
  const filteredMarket  = listings.filter(l=>!marketSearch||l.crop_name.toLowerCase().includes(marketSearch.toLowerCase())||(l.location||'').toLowerCase().includes(marketSearch.toLowerCase()));

  return (
    <div style={{width:'100%',minWidth:0,boxSizing:'border-box',paddingBottom:48}}>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast&&<motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}
          className="fixed top-4 right-4 z-[300] flex items-center gap-2 px-4 py-3 bg-green-900/90 border border-green-500/40 rounded-xl text-green-300 text-sm shadow-2xl">
          <FiCheckCircle size={14}/>{toast}
        </motion.div>}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="text-2xl">🌾</span> AgriHub
            <span className="text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Smart Farming</span>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {user?.full_name||user?.username} · Crop Management · Market Prices · Govt Schemes · Expert Q&A
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-xs text-green-400 font-semibold">Live Market Data</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 flex-wrap p-1 bg-white/5 rounded-xl mb-6">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab===t.id?'bg-green-500/20 text-green-400 border border-green-500/30':'text-gray-400 hover:text-white'}`}>
            <span>{t.icon}</span><span className="hidden sm:inline">{t.label.split(' ').slice(1).join(' ')}</span>
          </button>
        ))}
      </div>

      {/* ══ DASHBOARD TAB ══════════════════════════════════════════════════ */}
      {activeTab==='dashboard'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {icon:'🌱',label:'Active Crops',val:crops.filter(c=>c.status==='active').length,color:'text-green-400'},
              {icon:'🛒',label:'My Listings',  val:myListings.length,                          color:'text-yellow-400'},
              {icon:'💬',label:'My Questions', val:queries.filter(q=>q.farmer_username===user?.username).length,color:'text-blue-400'},
              {icon:'✅',label:'Answered',     val:queries.filter(q=>q.is_answered&&q.farmer_username===user?.username).length,color:'text-cyan-400'},
            ].map(({icon,label,val,color})=>(
              <div key={label} className="glass-card p-4">
                <div className="text-2xl mb-1">{icon}</div>
                <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="glass-card p-5">
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">⚡ Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {icon:'🌱',label:'Add Crop',      color:'bg-green-500/15 text-green-400 border-green-500/30',  action:()=>setShowAddCrop(true)},
                {icon:'🛒',label:'Sell Crop',     color:'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',action:()=>setShowAddListing(true)},
                {icon:'💬',label:'Ask Expert',    color:'bg-blue-500/15 text-blue-400 border-blue-500/30',    action:()=>setShowPostQuery(true)},
                {icon:'🤖',label:'Get AI Reco',   color:'bg-purple-500/15 text-purple-400 border-purple-500/30',action:()=>setActiveTab('recommend')},
              ].map(({icon,label,color,action})=>(
                <button key={label} onClick={action}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border font-semibold text-xs transition-all hover:opacity-85 ${color}`}>
                  <span className="text-2xl">{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent crops */}
          {crops.length>0&&(
            <div className="glass-card p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">🌱 Recent Crops</h2>
              <div className="space-y-2.5">
                {crops.slice(0,3).map(c=>(
                  <div key={c.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-white">{c.crop_name} {c.variety&&<span className="text-gray-500 font-normal text-xs">({c.variety})</span>}</p>
                      <p className="text-xs text-gray-500">{c.area_hectares&&`${c.area_hectares} ha · `}{c.soil_type||''}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 ${stageColor(c.growth_stage||'')}`}>{c.growth_stage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather tip */}
          <div className="glass-card p-5 border border-yellow-500/15">
            <h2 className="font-bold text-white mb-3 flex items-center gap-2"><FiThermometer size={15} className="text-yellow-400"/> Farming Tips</h2>
            <div className="space-y-2">
              {['🌧 Monitor soil moisture after heavy rainfall to prevent waterlogging.',
                '🌡 Apply mulching to conserve soil moisture during dry spells.',
                '🐛 Inspect crops weekly for early signs of pest infestation.',
                '📋 Maintain field records for better yield forecasting and loan eligibility.',
              ].map((tip,i)=>(
                <p key={i} className="text-xs text-gray-300 flex items-start gap-2">{tip}</p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ══ MY CROPS TAB ═══════════════════════════════════════════════════ */}
      {activeTab==='crops'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">🌱 My Crops ({crops.length})</h2>
            <div className="flex gap-2">
              <button onClick={loadCrops} disabled={loadingCrops}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400">
                <FiRefreshCw size={14} className={loadingCrops?'animate-spin':''}/>
              </button>
              <button onClick={()=>setShowAddCrop(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold text-sm rounded-xl transition-all">
                <FiPlus size={14}/> Add Crop
              </button>
            </div>
          </div>

          {loadingCrops&&<div className="flex items-center justify-center py-12 gap-3 text-gray-500"><FiLoader size={22} className="animate-spin text-green-400"/></div>}
          {!loadingCrops&&crops.length===0&&(
            <div className="glass-card p-14 text-center">
              <span className="text-5xl block mb-4">🌱</span>
              <p className="text-white font-semibold">No crops added yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-5">Start tracking your crops by clicking "Add Crop"</p>
              <button onClick={()=>setShowAddCrop(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-sm">
                <FiPlus size={13}/> Add Your First Crop
              </button>
            </div>
          )}

          {!loadingCrops&&crops.length>0&&(
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {crops.map((c,i)=>(
                <motion.div key={c.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                  className="glass-card p-5 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-white">{c.crop_name}</h3>
                      {c.variety&&<p className="text-xs text-gray-500">{c.variety}</p>}
                    </div>
                    <button onClick={()=>deleteCrop(c.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                      <FiTrash2 size={13}/>
                    </button>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {[
                      {icon:'📐',label:'Area',        val:c.area_hectares?`${c.area_hectares} ha`:'—'},
                      {icon:'🌱',label:'Stage',        val:c.growth_stage||'—'},
                      {icon:'🏔',label:'Soil',         val:c.soil_type||'—'},
                      {icon:'💧',label:'Irrigation',   val:c.irrigation_type||'—'},
                      {icon:'📅',label:'Sowing',       val:c.sowing_date?fmtDate(c.sowing_date):'—'},
                      {icon:'🌾',label:'Harvest ETA',  val:c.expected_harvest?fmtDate(c.expected_harvest):'—'},
                    ].map(({icon,label,val})=>(
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{icon} {label}</span>
                        <span className={`font-medium ${label==='Stage'?stageColor(val):'text-white'}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {c.notes&&<p className="text-[10px] text-gray-600 italic border-t border-white/5 pt-2">{c.notes}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status==='active'?'bg-green-500/15 text-green-400':'bg-gray-500/15 text-gray-400'}`}>
                      {c.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-gray-600">{fmtDate(c.created_at)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ══ MARKETPLACE TAB ════════════════════════════════════════════════ */}
      {activeTab==='market'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-white">🛒 Crop Marketplace</h2>
            <button onClick={()=>setShowAddListing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm rounded-xl">
              <FiPlus size={13}/> Sell Your Crop
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
            <input value={marketSearch} onChange={e=>setMarketSearch(e.target.value)}
              placeholder="Search crops, location…"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500/40"/>
          </div>

          {/* My listings */}
          {myListings.length>0&&(
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">📦 My Listings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myListings.map(l=>(
                  <div key={l.id} className="glass-card p-4 border border-yellow-500/15">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white">{l.crop_name} {l.variety&&<span className="text-gray-500 text-xs">({l.variety})</span>}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{l.quantity_kg}kg · ₹{l.price_per_kg}/{l.unit}</p>
                        {l.location&&<p className="text-xs text-gray-600">📍 {l.location}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {l.is_organic&&<span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/25 px-1.5 py-0.5 rounded-full">🌿 Organic</span>}
                        <button onClick={()=>deleteListing(l.id)} className="text-gray-600 hover:text-red-400 transition-colors"><FiTrash2 size={12}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-yellow-500 font-bold mt-2">Total: ₹{(l.quantity_kg*l.price_per_kg).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All market listings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">🌐 Available in Market ({filteredMarket.length})</h3>
            {loadingListings&&<div className="flex items-center justify-center py-10"><FiLoader size={22} className="animate-spin text-yellow-400"/></div>}
            {!loadingListings&&filteredMarket.length===0&&(
              <div className="glass-card p-10 text-center text-gray-500">
                <span className="text-3xl block mb-2">🛒</span>
                <p>No listings yet. Be the first to sell!</p>
              </div>
            )}
            {!loadingListings&&(
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMarket.map((l,i)=>(
                  <motion.div key={l.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
                    className="glass-card p-5 hover:border-white/20 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white">{l.crop_name}</h3>
                        {l.variety&&<p className="text-xs text-gray-500">{l.variety}</p>}
                      </div>
                      {l.is_organic&&<span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/25 px-1.5 py-0.5 rounded-full">🌿 Organic</span>}
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-extrabold text-yellow-400">₹{l.price_per_kg}</span>
                      <span className="text-xs text-gray-500">/{l.unit}</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-400 mb-4">
                      <p>📦 Available: <span className="text-white">{l.quantity_kg.toLocaleString('en-IN')} kg</span></p>
                      {l.location&&<p>📍 {l.location}</p>}
                      <p>👨‍🌾 {l.farmer_full_name||l.farmer_username}</p>
                    </div>
                    {l.description&&<p className="text-xs text-gray-500 line-clamp-2 mb-3 italic">{l.description}</p>}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <span className="text-xs text-gray-600">{fmtDate(l.created_at)}</span>
                      <span className="text-xs text-green-400 font-bold">Total: ₹{(l.quantity_kg*l.price_per_kg).toLocaleString('en-IN')}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ══ MANDI PRICES TAB ═══════════════════════════════════════════════ */}
      {activeTab==='prices'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-white">📊 Mandi Market Prices</h2>
            <button onClick={loadPrices} disabled={loadingPrices}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400">
              <FiRefreshCw size={14} className={loadingPrices?'animate-spin':''}/>
            </button>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl text-xs text-blue-300">
            <FiInfo size={12} className="shrink-0 mt-0.5"/><span>Indicative mandi prices for reference. Verify with local mandi/APMC before buying/selling. Source: Representative Indian mandi data.</span>
          </div>

          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/>
            <input value={priceSearch} onChange={e=>setPriceSearch(e.target.value)}
              placeholder="Search crop or state…"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/40"/>
          </div>

          {loadingPrices&&<div className="flex items-center justify-center py-12"><FiLoader size={22} className="animate-spin text-green-400"/></div>}

          {!loadingPrices&&(
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Crop','Variety','Min (₹)','Max (₹)','Modal (₹)','Market','State'].map(h=>(
                      <th key={h} className="px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPrices.map((p,i)=>(
                    <motion.tr key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.02}}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-white">{p.crop}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{p.variety}</td>
                      <td className="px-4 py-3 text-xs text-red-400 font-medium">₹{p.min.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-green-400 font-medium">₹{p.max.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-yellow-400">₹{p.modal.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{p.market}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.state}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-2 text-[10px] text-gray-700">Per Quintal (100 kg) unless stated · {filteredPrices.length} entries</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ══ GOVERNMENT SCHEMES TAB ════════════════════════════════════════ */}
      {activeTab==='schemes'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <h2 className="text-lg font-bold text-white">🏛 Government Schemes for Farmers</h2>
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {SCHEME_CATS.map(c=>(
              <button key={c} onClick={()=>setSchemesCat(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  schemesCat===c?'bg-green-500/20 text-green-400 border-green-500/30':'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                {c}
              </button>
            ))}
          </div>
          {loadingSchemes&&<div className="flex items-center justify-center py-12"><FiLoader size={22} className="animate-spin text-green-400"/></div>}
          {!loadingSchemes&&(
            <div className="space-y-4">
              {filteredSchemes.map((s,i)=>(
                <motion.div key={s.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}
                  className="glass-card p-5 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-white">{s.title}</h3>
                        {s.category&&<span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full">{s.category}</span>}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {s.eligibility&&(
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Eligibility</p>
                        <p className="text-xs text-gray-300">{s.eligibility}</p>
                      </div>
                    )}
                    {s.benefits&&(
                      <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
                        <p className="text-[10px] text-green-400 uppercase mb-1">Benefits</p>
                        <p className="text-xs text-gray-300">{s.benefits}</p>
                      </div>
                    )}
                  </div>
                  {s.apply_url&&(
                    <a href={s.apply_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold rounded-xl hover:bg-green-500/25 transition-all">
                      🔗 Apply / Learn More
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ══ EXPERT Q&A TAB ════════════════════════════════════════════════ */}
      {activeTab==='qa'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-white">💬 Expert Q&A</h2>
            <button onClick={()=>setShowPostQuery(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl">
              <FiPlus size={13}/> Ask Question
            </button>
          </div>
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>setQueryCat('')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${!queryCat?'bg-blue-500/20 text-blue-400 border-blue-500/30':'bg-white/5 border-white/10 text-gray-500'}`}>
              All
            </button>
            {QUERY_CATS.map(c=>(
              <button key={c} onClick={()=>setQueryCat(c===queryCat?'':c)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  queryCat===c?'bg-blue-500/20 text-blue-400 border-blue-500/30':'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}>
                {c}
              </button>
            ))}
          </div>
          {loadingQueries&&<div className="flex items-center justify-center py-12"><FiLoader size={22} className="animate-spin text-blue-400"/></div>}
          {!loadingQueries&&filteredQueries.length===0&&(
            <div className="glass-card p-12 text-center">
              <span className="text-4xl block mb-3">💬</span>
              <p className="text-white font-semibold">No questions yet</p>
              <p className="text-sm text-gray-500 mt-1">Be the first to ask a farming question!</p>
            </div>
          )}
          {!loadingQueries&&(
            <div className="space-y-3">
              {filteredQueries.map((q,i)=>(
                <motion.div key={q.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                  className={`glass-card p-5 hover:border-white/20 transition-all ${q.is_answered?'border-green-500/15':''}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {q.category&&<span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full">{q.category}</span>}
                        {q.is_answered&&<span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">✅ Answered</span>}
                      </div>
                      <h3 className="font-semibold text-white">{q.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-3">{q.description}</p>
                  {q.is_answered&&q.answer&&(
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-green-400 uppercase font-bold mb-1">✅ Expert Answer</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{q.answer}</p>
                      {q.answered_at&&<p className="text-[10px] text-gray-600 mt-1">Answered {fmtDate(q.answered_at)}</p>}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                    <span>👨‍🌾 {q.farmer_username}</span>
                    <span>{fmtDate(q.created_at)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ══ CROP RECOMMENDER TAB ══════════════════════════════════════════ */}
      {activeTab==='recommend'&&(
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">🤖 AI Crop Recommender</h2>
            <p className="text-sm text-gray-400 mt-1">Get crop recommendations based on your soil type, location and season.</p>
          </div>

          <div className="glass-card p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-400 mb-1.5">Soil Type *</label>
                <select value={recForm.soil_type} onChange={e=>setRecForm({...recForm,soil_type:e.target.value})} className={selectCls}>
                  <option value="">Select soil type</option>
                  {SOIL_TYPES.map(s=><option key={s} value={s} className="bg-gray-900">{s}</option>)}
                </select></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">Season *</label>
                <select value={recForm.season} onChange={e=>setRecForm({...recForm,season:e.target.value})} className={selectCls}>
                  <option value="">Select season</option>
                  {SEASONS.map(s=><option key={s} value={s} className="bg-gray-900">{s}</option>)}
                </select></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">State / Region</label>
                <input value={recForm.state} onChange={e=>setRecForm({...recForm,state:e.target.value})} className={inputCls} placeholder="e.g. West Bengal, Maharashtra"/></div>
              <div><label className="block text-xs text-gray-400 mb-1.5">Rainfall Pattern</label>
                <select value={recForm.rainfall} onChange={e=>setRecForm({...recForm,rainfall:e.target.value})} className={selectCls}>
                  <option value="">Select rainfall</option>
                  {RAINFALLS.map(r=><option key={r} value={r} className="bg-gray-900">{r}</option>)}
                </select></div>
            </div>
            <button onClick={runRecommender} disabled={recLoading}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-400 disabled:bg-green-500/40 text-black font-bold rounded-xl text-sm transition-all">
              {recLoading?<FiLoader size={15} className="animate-spin"/>:<span>🤖</span>}
              {recLoading?'Analysing…':'Get Crop Recommendations'}
            </button>
          </div>

          {recResult&&(
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="glass-card p-6 border border-green-500/20">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                ✅ Recommended Crops for {recForm.season} · {recForm.soil_type} Soil
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recResult.recommendations.map((r,i)=>(
                  <motion.div key={i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}
                    className={`flex items-start gap-3 p-4 rounded-xl border ${
                      r.suitability==='High'?'bg-green-500/8 border-green-500/25':
                      r.suitability==='Medium'?'bg-yellow-500/8 border-yellow-500/25':
                      'bg-white/5 border-white/10'}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      r.suitability==='High'?'bg-green-400':r.suitability==='Medium'?'bg-yellow-400':'bg-gray-400'}`}/>
                    <div>
                      <p className="font-semibold text-white text-sm">{r.crop}</p>
                      <p className={`text-[10px] font-bold uppercase ${r.suitability==='High'?'text-green-400':r.suitability==='Medium'?'text-yellow-400':'text-gray-400'}`}>
                        {r.suitability} Suitability
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{r.reason}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-4">{recResult.note||'Rule-based recommendations — consult local Krishi Vigyan Kendra for expert advice.'}</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddCrop&&<AddCropModal onClose={()=>setShowAddCrop(false)} authFetch={authFetch}
          onCreated={c=>{setCrops(p=>[c,...p]);setShowAddCrop(false);flash('Crop added successfully!');}}/>}
        {showAddListing&&<AddListingModal onClose={()=>setShowAddListing(false)} authFetch={authFetch}
          onCreated={l=>{setMyListings(p=>[l,...p]);setShowAddListing(false);flash('Listing posted!');}}/>}
        {showPostQuery&&<PostQueryModal onClose={()=>setShowPostQuery(false)} authFetch={authFetch}
          onCreated={q=>{setQueries(p=>[q,...p]);setShowPostQuery(false);flash('Question posted!');}}/>}
      </AnimatePresence>
    </div>
  );
};

export default Agriculture;
