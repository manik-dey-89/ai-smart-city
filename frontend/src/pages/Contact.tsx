import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiMail, FiUser, FiMessageSquare, FiSend, FiLoader,
  FiCheckCircle, FiAlertCircle, FiMapPin, FiPhone, FiClock,
  FiGithub, FiShield,
} from 'react-icons/fi'
import PublicNavbar from '../components/PublicNavbar'
import PublicFooter from '../components/PublicFooter'

/* ── Types ──────────────────────────────────────────────────── */
interface FormState {
  name: string
  email: string
  subject: string
  message: string
}
interface FormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}

const SUBJECTS = [
  'General Enquiry',
  'Technical Support',
  'Report a Bug',
  'Feature Request',
  'Complaint System Help',
  'Emergency Services Info',
  'Partnership / Integration',
  'Media / Press',
  'Other',
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.4, delay },
})

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim() || form.name.trim().length < 2)
    errors.name = 'Full name must be at least 2 characters.'
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.email.trim() || !emailRe.test(form.email))
    errors.email = 'Enter a valid email address.'
  if (!form.subject.trim() || form.subject.trim().length < 3)
    errors.subject = 'Please select or enter a subject.'
  if (!form.message.trim() || form.message.trim().length < 10)
    errors.message = 'Message must be at least 10 characters.'
  return errors
}

/* ── Toast ──────────────────────────────────────────────────── */
const Toast: React.FC<{ type: 'success' | 'error'; message: string; onClose: () => void }> = ({ type, message, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
    className={`fixed top-6 right-6 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border max-w-sm
      ${type === 'success'
        ? 'bg-green-900/90 border-green-500/40 text-green-300'
        : 'bg-red-900/90 border-red-500/40 text-red-300'}`}>
    {type === 'success' ? <FiCheckCircle size={16} /> : <FiAlertCircle size={16} />}
    <p className="text-sm font-medium flex-1">{message}</p>
    <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
  </motion.div>
)

/* ══ Component ══════════════════════════════════════════════════ */
export default function Contact() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.value
    setForm(f => ({ ...f, [field]: val }))
    if (touched[field]) {
      const errs = validate({ ...form, [field]: val })
      setErrors(prev => ({ ...prev, [field]: errs[field] }))
    }
  }

  const blur = (field: keyof FormState) => () => {
    setTouched(t => ({ ...t, [field]: true }))
    const errs = validate(form)
    setErrors(prev => ({ ...prev, [field]: errs[field] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const allTouched = { name: true, email: true, subject: true, message: true }
    setTouched(allTouched)
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      })

      if (res.status === 429) {
        const j = await res.json().catch(() => ({}))
        setToast({ type: 'error', msg: j.detail || 'Too many messages today. Please try again tomorrow.' })
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setToast({ type: 'error', msg: j.detail || 'Failed to send message. Please try again.' })
        return
      }

      setSubmitted(true)
      setForm({ name: '', email: '', subject: '', message: '' })
      setTouched({})
      setToast({ type: 'success', msg: 'Your message has been sent! We\'ll get back to you within 24 hours.' })
      setTimeout(() => setToast(null), 5000)
    } catch {
      setToast({ type: 'error', msg: 'Network error — please check your connection and try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = `w-full bg-white/5 border rounded-xl px-4 py-3 text-white text-sm
    placeholder-gray-600 focus:outline-none transition-all`
  const inputCls = (field: keyof FormState) =>
    `${inputBase} ${errors[field] && touched[field]
      ? 'border-red-500/50 focus:border-red-500/70'
      : 'border-white/10 focus:border-cyan-500/50'}`

  return (
    <div className="min-h-screen bg-[#070f1a] text-white overflow-x-hidden">
      <PublicNavbar active="Contact" />

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast type={toast.type} message={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>
        <motion.div {...fadeUp()} className="max-w-2xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold mb-6">
            <FiMail size={13} /> Get In Touch
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
            Talk to the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">
              SmartCity Team
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            Questions, feedback, partnership enquiries or technical support — we read every message.
          </p>
        </motion.div>
      </section>

      {/* ── Main grid ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">

        {/* ── Left: Info ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <motion.div {...fadeUp(0.05)} className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6">
            <h2 className="font-bold text-white text-lg mb-5">Contact Information</h2>
            <div className="space-y-4">
              {[
                { icon: FiMail,   color: 'text-cyan-400',   label: 'Email',    val: 'contact@smartcity.gov' },
                { icon: FiPhone,  color: 'text-green-400',  label: 'Helpline', val: '1800-SMART-CITY (toll-free)' },
                { icon: FiMapPin, color: 'text-purple-400', label: 'Office',   val: 'Smart City Command Centre, Kolkata, West Bengal' },
                { icon: FiClock,  color: 'text-yellow-400', label: 'Hours',    val: 'Mon–Fri 09:00–18:00 IST' },
              ].map(({ icon: Icon, color, label, val }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white/5 shrink-0`}>
                    <Icon size={14} className={color} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm text-gray-200 font-medium mt-0.5">{val}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick links */}
          <motion.div {...fadeUp(0.1)} className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-white text-sm mb-4">Quick Resources</h3>
            <div className="space-y-2.5">
              {[
                { icon: FiGithub,       label: 'Open-Source Repository', href: 'https://github.com' },
                { icon: FiShield,       label: 'Emergency Helplines',    href: '/login?role=emergency' },
                { icon: FiMessageSquare,label: 'File a Complaint',        href: '/login?role=citizen' },
              ].map(({ icon: Icon, label, href }) => (
                <a key={label} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all group text-sm text-gray-300 hover:text-white">
                  <Icon size={14} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                  {label}
                </a>
              ))}
            </div>
          </motion.div>

          {/* Response time note */}
          <motion.div {...fadeUp(0.15)}
            className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <FiCheckCircle size={14} className="text-green-400" />
              <p className="text-sm font-semibold text-green-400">We respond fast</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Typical response time is under 24 hours on business days. Emergency issues are escalated immediately.
            </p>
          </motion.div>
        </div>

        {/* ── Right: Form ─────────────────────────────────── */}
        <motion.div {...fadeUp(0.08)} className="lg:col-span-3">
          <div className="bg-[#0d1b2a]/80 border border-white/10 rounded-2xl p-8">

            <AnimatePresence mode="wait">
              {submitted ? (
                /* Success state */
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
                    <FiCheckCircle size={28} className="text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Message Sent!</h2>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
                    Thank you for reaching out. Our team will review your message and respond within 24 hours.
                  </p>
                  <button onClick={() => setSubmitted(false)}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white transition-all">
                    Send Another Message
                  </button>
                </motion.div>
              ) : (
                /* Form */
                <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Send a Message</h2>
                    <p className="text-sm text-gray-500">All fields are required unless marked optional</p>
                  </div>

                  {/* Name + Email row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        <FiUser size={11} className="inline mr-1" /> Full Name
                      </label>
                      <input type="text" value={form.name} onChange={set('name')} onBlur={blur('name')}
                        placeholder="John Citizen" className={inputCls('name')} />
                      {errors.name && touched.name && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <FiAlertCircle size={10} /> {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        <FiMail size={11} className="inline mr-1" /> Email Address
                      </label>
                      <input type="email" value={form.email} onChange={set('email')} onBlur={blur('email')}
                        placeholder="you@example.com" className={inputCls('email')} />
                      {errors.email && touched.email && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <FiAlertCircle size={10} /> {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject</label>
                    <select value={form.subject} onChange={set('subject')} onBlur={blur('subject')}
                      className={`${inputCls('subject')} appearance-none`}
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <option value="" disabled className="bg-[#0d1b2a] text-gray-500">Select a subject…</option>
                      {SUBJECTS.map(s => (
                        <option key={s} value={s} className="bg-[#0d1b2a] text-white">{s}</option>
                      ))}
                    </select>
                    {errors.subject && touched.subject && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <FiAlertCircle size={10} /> {errors.subject}
                      </p>
                    )}
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      <FiMessageSquare size={11} className="inline mr-1" /> Message
                    </label>
                    <textarea value={form.message} onChange={set('message')} onBlur={blur('message')}
                      placeholder="Describe your question or issue in detail…"
                      rows={6}
                      className={`${inputCls('message')} resize-none`} />
                    <div className="flex items-center justify-between mt-1">
                      {errors.message && touched.message ? (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <FiAlertCircle size={10} /> {errors.message}
                        </p>
                      ) : <span />}
                      <p className={`text-xs ${form.message.length > 4500 ? 'text-red-400' : 'text-gray-600'}`}>
                        {form.message.length}/5000
                      </p>
                    </div>
                  </div>

                  {/* Privacy note */}
                  <div className="flex items-start gap-2.5 p-3.5 bg-white/5 rounded-xl border border-white/8">
                    <FiShield size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Your message is stored securely in our database and will only be seen by the SmartCity team.
                      We do not sell or share your personal information.
                    </p>
                  </div>

                  <button type="submit" disabled={submitting}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm
                               bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-black
                               transition-all shadow-lg shadow-cyan-500/20">
                    {submitting
                      ? <><FiLoader size={15} className="animate-spin" /> Sending…</>
                      : <><FiSend size={15} /> Send Message</>}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </section>

      {/* ── Map placeholder ───────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <motion.div {...fadeUp()}
          className="bg-[#0d1b2a]/60 border border-white/10 rounded-2xl overflow-hidden h-56 relative flex items-center justify-center">
          <div className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(6,182,212,0.08) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }} />
          <div className="relative z-10 text-center">
            <FiMapPin size={28} className="text-cyan-400 mx-auto mb-2" />
            <p className="text-white font-semibold">Smart City Command Centre</p>
            <p className="text-sm text-gray-400 mt-1">Kolkata Metropolitan Area, West Bengal, India</p>
          </div>
          {/* Corner dots */}
          {[
            { top: '20%', left: '15%', c: 'bg-green-400' },
            { top: '60%', left: '30%', c: 'bg-cyan-400'  },
            { top: '35%', left: '65%', c: 'bg-orange-400'},
            { top: '70%', left: '80%', c: 'bg-purple-400'},
          ].map((d, i) => (
            <span key={i} className={`absolute w-3 h-3 ${d.c} rounded-full shadow-lg animate-pulse`}
              style={{ top: d.top, left: d.left }} />
          ))}
        </motion.div>
      </section>

      <PublicFooter />
    </div>
  )
}
