import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser, FiMail, FiPhone, FiLock, FiEdit2, FiSave,
  FiAlertCircle, FiCheckCircle, FiX, FiEye, FiEyeOff,
  FiShield, FiKey,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  citizen: 'Citizen', admin: 'City Admin', city_admin: 'City Admin',
  super_admin: 'Super Admin', traffic_officer: 'Traffic Officer',
  police: 'Police', fire_service: 'Fire Service', emergency: 'Emergency Responder',
};

const inputCls = `w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm
  placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all`;

/* ── Toast helper ─────────────────────────────────────────────────────────── */
const Toast: React.FC<{ type: 'success' | 'error'; text: string; onClose: () => void }> = ({ type, text, onClose }) => (
  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
    className={`flex items-center gap-3 p-4 rounded-xl border text-sm mb-5 ${
      type === 'success'
        ? 'bg-green-500/10 border-green-500/20 text-green-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'
    }`}>
    {type === 'success' ? <FiCheckCircle size={15} /> : <FiAlertCircle size={15} />}
    <span className="flex-1">{text}</span>
    <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100"><FiX size={14} /></button>
  </motion.div>
);

/* ══ Profile Page ══════════════════════════════════════════════════════════════ */
const Profile: React.FC = () => {
  const { user, authFetch, refreshUser } = useAuth();

  // Profile edit state
  const [isEditing, setIsEditing]     = useState(false);
  const [saving,    setSaving]        = useState(false);
  const [profileMsg, setProfileMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm]               = useState({ full_name: '', email: '', phone: '' });

  // Change password state
  const [showPwPanel, setShowPwPanel] = useState(false);
  const [pwSaving,   setPwSaving]    = useState(false);
  const [pwMsg,      setPwMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwForm,     setPwForm]      = useState({ old_password: '', new_password: '', confirm: '' });
  const [showOld,    setShowOld]     = useState(false);
  const [showNew,    setShowNew]     = useState(false);
  const [showConf,   setShowConf]    = useState(false);

  // Sync form when user object changes
  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email:     user.email    || '',
        phone:     user.phone    || '',
      });
    }
  }, [user]);

  /* ── Save profile changes ─────────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true); setProfileMsg(null);
    try {
      // Only send fields that changed
      const payload: Record<string, string> = {};
      if (form.full_name !== (user?.full_name || '')) payload.full_name = form.full_name;
      if (form.email     !== (user?.email     || '')) payload.email     = form.email;
      if (form.phone     !== (user?.phone     || '')) payload.phone     = form.phone;

      if (Object.keys(payload).length === 0) {
        setProfileMsg({ type: 'success', text: 'No changes to save.' });
        setIsEditing(false); return;
      }

      const res = await authFetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update profile');
      }

      // Re-fetch fresh user data from server → updates AuthContext + localStorage
      await refreshUser();

      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
      setIsEditing(false);
    } catch (e) {
      setProfileMsg({ type: 'error', text: e instanceof Error ? e.message : 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Change password ──────────────────────────────────────────────────── */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (pwForm.new_password.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return;
    }
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return;
    }

    setPwSaving(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: pwForm.old_password,
          new_password: pwForm.new_password,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Password change failed');
      }

      setPwMsg({ type: 'success', text: 'Password changed successfully. Please log in again next session.' });
      setPwForm({ old_password: '', new_password: '', confirm: '' });
      setTimeout(() => setShowPwPanel(false), 2500);
    } catch (e) {
      setPwMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to change password' });
    } finally {
      setPwSaving(false);
    }
  };

  if (!user) return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <FiUser size={24} className="mr-2" /> Please log in to view your profile.
    </div>
  );

  const role     = user.roles?.[0]?.name || 'citizen';
  const initials = (user.full_name || user.username).charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <FiUser size={22} className="text-cyan-400" /> My Profile
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account details and security settings</p>
      </div>

      {/* ── Profile card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 space-y-6">

        {/* Avatar + role */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg shadow-cyan-500/20">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{user.full_name || user.username}</p>
              <p className="text-sm text-gray-400">@{user.username}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <FiShield size={10} /> {ROLE_LABELS[role] ?? role}
              </span>
            </div>
          </div>
          <button onClick={() => { setIsEditing(!isEditing); setProfileMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
              isEditing
                ? 'bg-white/5 border-white/15 text-gray-400 hover:bg-white/10'
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
            }`}>
            {isEditing ? <><FiX size={13}/> Cancel</> : <><FiEdit2 size={13}/> Edit Profile</>}
          </button>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {profileMsg && <Toast type={profileMsg.type} text={profileMsg.text} onClose={() => setProfileMsg(null)}/>}
        </AnimatePresence>

        {/* Fields */}
        <div className="space-y-4 pt-4 border-t border-white/8">

          {/* Username — read-only */}
          <div>
            <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Username</label>
            <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
              <FiUser size={14} className="text-gray-500" />
              <span className="text-gray-300 text-sm">{user.username}</span>
              <span className="ml-auto text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">Cannot change</span>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Full Name</label>
            {isEditing ? (
              <input type="text" value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your full name" className={inputCls} />
            ) : (
              <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                <FiUser size={14} className="text-gray-500" />
                <span className="text-sm text-white">{user.full_name || <span className="text-gray-600">Not set</span>}</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Email Address</label>
            {isEditing ? (
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com" className={inputCls} />
            ) : (
              <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                <FiMail size={14} className="text-gray-500" />
                <span className="text-sm text-white">{user.email}</span>
                {user.is_verified && (
                  <span className="ml-auto text-[10px] text-green-400 flex items-center gap-1">
                    <FiCheckCircle size={10}/> Verified
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Phone Number</label>
            {isEditing ? (
              <input type="tel" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 9876543210" className={inputCls} />
            ) : (
              <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                <FiPhone size={14} className="text-gray-500" />
                <span className="text-sm text-white">{user.phone || <span className="text-gray-600">Not set</span>}</span>
              </div>
            )}
          </div>

          {/* Account status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
              <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-400">Account <span className={user.is_active ? 'text-green-400' : 'text-red-400'}>{user.is_active ? 'Active' : 'Inactive'}</span></span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
              <FiShield size={13} className={user.is_verified ? 'text-green-400' : 'text-gray-500'} />
              <span className="text-xs text-gray-400">Email <span className={user.is_verified ? 'text-green-400' : 'text-gray-500'}>{user.is_verified ? 'Verified' : 'Unverified'}</span></span>
            </div>
          </div>
        </div>

        {/* Save / Cancel buttons */}
        <AnimatePresence>
          {isEditing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="flex gap-3 pt-4 border-t border-white/8 overflow-hidden">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400
                           disabled:bg-cyan-500/40 text-black font-bold py-3 rounded-xl text-sm transition-all">
                {saving ? <><span className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin"/> Saving…</>
                         : <><FiSave size={14}/> Save Changes</>}
              </button>
              <button onClick={() => { setIsEditing(false); setProfileMsg(null); setForm({ full_name: user.full_name||'', email: user.email||'', phone: user.phone||'' }); }}
                className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm transition-all">
                Discard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Change Password card ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="glass-card overflow-hidden">

        {/* Header toggle */}
        <button onClick={() => { setShowPwPanel(!showPwPanel); setPwMsg(null); setPwForm({ old_password:'', new_password:'', confirm:'' }); }}
          className="w-full flex items-center justify-between p-6 hover:bg-white/3 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15">
              <FiKey size={16} className="text-purple-400" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white text-sm">Change Password</p>
              <p className="text-xs text-gray-500 mt-0.5">Update your account password securely</p>
            </div>
          </div>
          <motion.div animate={{ rotate: showPwPanel ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </motion.div>
        </button>

        {/* Password form */}
        <AnimatePresence>
          {showPwPanel && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <form onSubmit={handleChangePassword} className="px-6 pb-6 space-y-4 border-t border-white/8 pt-5">

                <AnimatePresence>
                  {pwMsg && <Toast type={pwMsg.type} text={pwMsg.text} onClose={() => setPwMsg(null)}/>}
                </AnimatePresence>

                {/* Current password */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Current Password</label>
                  <div className="relative">
                    <FiLock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"/>
                    <input type={showOld ? 'text' : 'password'} value={pwForm.old_password}
                      onChange={e => setPwForm({ ...pwForm, old_password: e.target.value })}
                      placeholder="Enter current password" required
                      className={`${inputCls} pl-10 pr-10`} />
                    <button type="button" onClick={() => setShowOld(!showOld)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                      {showOld ? <FiEyeOff size={15}/> : <FiEye size={15}/>}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">New Password</label>
                  <div className="relative">
                    <FiLock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"/>
                    <input type={showNew ? 'text' : 'password'} value={pwForm.new_password}
                      onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })}
                      placeholder="At least 8 characters" required minLength={8}
                      className={`${inputCls} pl-10 pr-10`} />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                      {showNew ? <FiEyeOff size={15}/> : <FiEye size={15}/>}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {pwForm.new_password.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {[1,2,3,4].map(lvl => {
                        const strength = pwForm.new_password.length >= 12 && /[A-Z]/.test(pwForm.new_password) && /\d/.test(pwForm.new_password) && /[^a-zA-Z0-9]/.test(pwForm.new_password) ? 4
                          : pwForm.new_password.length >= 10 && /[A-Z]/.test(pwForm.new_password) ? 3
                          : pwForm.new_password.length >= 8 ? 2 : 1;
                        return (
                          <div key={lvl} className={`flex-1 h-1 rounded-full transition-all ${
                            lvl <= strength
                              ? strength >= 4 ? 'bg-green-400' : strength >= 3 ? 'bg-yellow-400' : strength >= 2 ? 'bg-orange-400' : 'bg-red-400'
                              : 'bg-white/10'
                          }`}/>
                        );
                      })}
                      <span className="text-[10px] text-gray-500 ml-1">
                        {pwForm.new_password.length < 8 ? 'Weak' : pwForm.new_password.length < 10 ? 'Fair' : pwForm.new_password.length < 12 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm new password */}
                <div>
                  <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <FiLock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"/>
                    <input type={showConf ? 'text' : 'password'} value={pwForm.confirm}
                      onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                      placeholder="Re-enter new password" required
                      className={`${inputCls} pl-10 pr-10 ${
                        pwForm.confirm && pwForm.confirm !== pwForm.new_password ? 'border-red-500/40' : ''
                      }`} />
                    <button type="button" onClick={() => setShowConf(!showConf)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                      {showConf ? <FiEyeOff size={15}/> : <FiEye size={15}/>}
                    </button>
                  </div>
                  {pwForm.confirm && pwForm.confirm !== pwForm.new_password && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><FiAlertCircle size={10}/>Passwords do not match</p>
                  )}
                </div>

                <button type="submit" disabled={pwSaving}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-400
                             disabled:bg-purple-500/40 text-white font-bold py-3 rounded-xl text-sm transition-all mt-2">
                  {pwSaving
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/> Updating…</>
                    : <><FiKey size={14}/> Update Password</>}
                </button>

                <p className="text-[10px] text-gray-600 text-center">
                  Password must be at least 8 characters. Use a mix of letters, numbers and symbols for better security.
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
};

export default Profile;
