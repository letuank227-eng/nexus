'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type RegisterStep = 'phone' | 'otp' | 'info'
type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [regStep, setRegStep] = useState<RegisterStep>('phone')

  // Login form
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  // Register form
  const [phone, setPhone] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', companyCode: '' })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [devOtp, setDevOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [phoneVerified, setPhoneVerified] = useState(false)

  // OTP input refs
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const resetRegister = () => {
    setRegStep('phone'); setPhone(''); setOtpDigits(['','','','','',''])
    setRegForm({ name:'', email:'', password:'', companyCode:'' })
    setDevOtp(''); setPhoneVerified(false); setCountdown(0)
  }

  // ── Step 1: Send OTP ──
  const sendOtp = async () => {
    if (!phone.trim() || phone.replace(/\D/g,'').length < 9) {
      setError('Vui lòng nhập số điện thoại hợp lệ (9-11 số)'); return
    }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setDevOtp(data.devOtp || '')
    setCountdown(300)
    setRegStep('otp')
    setTimeout(() => otpRefs.current[0]?.focus(), 100)
  }

  // ── OTP input handling ──
  const handleOtpDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otpDigits]; next[i] = val
    setOtpDigits(next)
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
    if (!val && i > 0) otpRefs.current[i - 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus()
  }
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (paste.length === 6) {
      setOtpDigits(paste.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  // ── Step 2: Verify OTP ──
  const verifyOtp = async () => {
    const code = otpDigits.join('')
    if (code.length < 6) { setError('Vui lòng nhập đủ 6 chữ số'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setPhoneVerified(true)
    setRegStep('info')
  }

  // ── Step 3: Complete registration ──
  const completeRegister = async () => {
    if (!regForm.name.trim() || !regForm.email.trim() || !regForm.password) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc'); return
    }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: regForm.name, email: regForm.email, password: regForm.password,
        phone, companyCode: regForm.companyCode
      })
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess(data.message)
    setMode('login')
    resetRegister()
  }

  // ── Login ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    router.push('/app')
  }

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white relative overflow-hidden px-6">
      {/* BG blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-50 rounded-full blur-[80px]"/>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-purple-50 rounded-full blur-[80px]"/>
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007AFF] to-purple-600 mb-3 shadow-lg shadow-blue-500/25">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-[26px] font-bold text-gray-900">WorkHub</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Nền tảng cộng tác doanh nghiệp</p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-gray-100 rounded-full p-1 mb-5">
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess(''); resetRegister() }}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {m === 'login' ? '🔑 Đăng nhập' : '📋 Đăng ký'}
            </button>
          ))}
        </div>

        {/* ══════════ LOGIN ══════════ */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-xl shadow-gray-200/80 border border-gray-100 p-6 space-y-4">
            <div>
              <label className="label-sm">Email *</label>
              <div className="relative">
                <span className="icon-left">✉️</span>
                <input type="email" required value={loginForm.email}
                  onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@company.com" className="input-f pl-9"/>
              </div>
            </div>
            <div>
              <label className="label-sm">Mật khẩu *</label>
              <div className="relative">
                <span className="icon-left">🔒</span>
                <input type={showPass ? 'text' : 'password'} required value={loginForm.password}
                  onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" className="input-f pl-9 pr-10"/>
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <div className="err-box">⚠️ {error}</div>}
            {success && <div className="ok-box">✅ {success}</div>}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Spinner/> : 'Đăng nhập'}
            </button>

            <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-2">Demo accounts</p>
              {[{ e:'admin@nexus.com',l:'👑 Admin' },{ e:'user@nexus.com',l:'👤 User' }].map(d => (
                <button key={d.e} type="button" onClick={() => setLoginForm({ email:d.e, password:'password123' })}
                  className="block w-full text-left text-[12px] text-[#007AFF] py-1.5 px-3 rounded-lg hover:bg-blue-50 transition-colors">
                  {d.l} — {d.e}
                </button>
              ))}
              <p className="text-[10px] text-gray-400 text-center mt-1">Mật khẩu: password123</p>
            </div>
          </form>
        )}

        {/* ══════════ REGISTER ══════════ */}
        {mode === 'register' && (
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/80 border border-gray-100 overflow-hidden">
            {/* Step indicator */}
            <div className="flex border-b border-gray-100 bg-gray-50/50">
              {[
                { n:1, s:'phone', label:'SĐT' },
                { n:2, s:'otp',   label:'OTP' },
                { n:3, s:'info',  label:'Thông tin' },
              ].map((step, i) => {
                const done = (regStep === 'otp' && step.n === 1) || (regStep === 'info' && step.n <= 2)
                const active = regStep === step.s
                return (
                  <div key={step.s} className="flex-1 flex flex-col items-center py-3 gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      done   ? 'bg-green-500 border-green-500 text-white' :
                      active ? 'bg-[#007AFF] border-[#007AFF] text-white' :
                               'bg-white border-gray-200 text-gray-400'
                    }`}>
                      {done ? '✓' : step.n}
                    </div>
                    <span className={`text-[10px] font-semibold ${active ? 'text-[#007AFF]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="p-6 space-y-4">
              {/* ── STEP 1: Phone ── */}
              {regStep === 'phone' && (
                <>
                  <div className="text-center mb-2">
                    <div className="text-4xl mb-2">📱</div>
                    <h2 className="font-bold text-gray-900 text-[17px]">Nhập số điện thoại</h2>
                    <p className="text-gray-500 text-sm mt-1">Chúng tôi sẽ gửi mã OTP để xác thực</p>
                  </div>
                  <div>
                    <label className="label-sm">Số điện thoại *</label>
                    <div className="flex gap-2">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-700 shrink-0 font-medium">🇻🇳 +84</div>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendOtp()}
                        placeholder="912 345 678" autoFocus
                        className="input-f flex-1" maxLength={11}/>
                    </div>
                  </div>
                  {error && <div className="err-box">⚠️ {error}</div>}
                  <button onClick={sendOtp} disabled={loading} className="btn-primary">
                    {loading ? <Spinner/> : '📨 Gửi mã OTP'}
                  </button>
                </>
              )}

              {/* ── STEP 2: OTP ── */}
              {regStep === 'otp' && (
                <>
                  <div className="text-center mb-2">
                    <div className="text-4xl mb-2">🔐</div>
                    <h2 className="font-bold text-gray-900 text-[17px]">Nhập mã OTP</h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Đã gửi mã 6 chữ số đến<br/>
                      <span className="font-semibold text-gray-900">+84 {phone}</span>
                    </p>
                  </div>

                  {/* DEV OTP Banner */}
                  {devOtp && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-center">
                      <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1">🧪 Chế độ phát triển</p>
                      <p className="text-2xl font-mono font-bold text-amber-800 tracking-[0.3em]">
                        {devOtp}
                      </p>
                      <p className="text-[10px] text-amber-600 mt-1">Mã này chỉ hiện khi chưa kết nối SMS thật</p>
                    </div>
                  )}

                  {/* OTP input boxes */}
                  <div className="flex justify-center gap-2.5 my-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <input key={i} ref={el => { otpRefs.current[i] = el }}
                        type="text" inputMode="numeric" maxLength={1} value={d}
                        onChange={e => handleOtpDigit(i, e.target.value)}
                        onKeyDown={e => handleOtpKey(i, e)}
                        className={`w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all ${
                          d ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]' : 'border-gray-200 bg-gray-50 text-gray-900'
                        } focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100`}/>
                    ))}
                  </div>

                  {/* Countdown + Resend */}
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-gray-500">
                        Gửi lại sau <span className="font-bold text-[#007AFF]">{formatCountdown(countdown)}</span>
                      </p>
                    ) : (
                      <button onClick={sendOtp} className="text-sm text-[#007AFF] font-semibold hover:underline">
                        Gửi lại mã OTP
                      </button>
                    )}
                  </div>

                  {error && <div className="err-box">⚠️ {error}</div>}

                  <div className="flex gap-3">
                    <button onClick={() => { setRegStep('phone'); setError(''); setOtpDigits(['','','','','','']) }}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm">
                      ← Quay lại
                    </button>
                    <button onClick={verifyOtp} disabled={loading || otpDigits.join('').length < 6}
                      className="flex-1 btn-primary">
                      {loading ? <Spinner/> : 'Xác nhận'}
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 3: Register info ── */}
              {regStep === 'info' && (
                <>
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mb-1">
                    <span className="text-green-500 text-lg">✅</span>
                    <div>
                      <p className="text-[12px] font-bold text-green-800">SĐT đã được xác thực</p>
                      <p className="text-[11px] text-green-600">+84 {phone}</p>
                    </div>
                  </div>

                  <div>
                    <label className="label-sm">Họ và tên *</label>
                    <input type="text" required value={regForm.name}
                      onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nguyễn Văn A" autoFocus className="input-f"/>
                  </div>
                  <div>
                    <label className="label-sm">Email *</label>
                    <div className="relative">
                      <span className="icon-left">✉️</span>
                      <input type="email" required value={regForm.email}
                        onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@company.com" className="input-f pl-9"/>
                    </div>
                  </div>
                  <div>
                    <label className="label-sm">Mật khẩu *</label>
                    <div className="relative">
                      <span className="icon-left">🔒</span>
                      <input type={showPass ? 'text' : 'password'} required value={regForm.password}
                        onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Tối thiểu 8 ký tự" className="input-f pl-9 pr-10"/>
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label-sm">
                      Mã số công ty
                      <span className="ml-1.5 text-[10px] font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full normal-case">
                        Để tham gia nhóm công ty
                      </span>
                    </label>
                    <div className="relative">
                      <span className="icon-left">🏢</span>
                      <input type="text" value={regForm.companyCode}
                        onChange={e => setRegForm(f => ({ ...f, companyCode: e.target.value.toUpperCase() }))}
                        placeholder="vd: NEXUS2024" className="input-f pl-9 uppercase tracking-widest font-mono"
                        maxLength={20}/>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Nhập đúng mã để tự động tham gia tất cả kênh công ty.</p>
                  </div>

                  {error && <div className="err-box">⚠️ {error}</div>}

                  <button onClick={completeRegister} disabled={loading} className="btn-primary">
                    {loading ? <Spinner/> : '🎉 Tạo tài khoản'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-gray-400 text-[11px] mt-5">WorkHub v1.0 · Nền tảng cộng tác doanh nghiệp</p>
      </div>

      <style>{`
        .input-f {
          width: 100%; background: #f9fafb; border: 1.5px solid #e5e7eb;
          border-radius: 12px; padding: 12px 16px; font-size: 14px;
          color: #111827; outline: none; transition: all 0.15s;
        }
        .input-f:focus { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.1); background: white; }
        .input-f::placeholder { color: #9ca3af; }
        .input-f.pl-9 { padding-left: 36px; }
        .input-f.pr-10 { padding-right: 40px; }
        .label-sm { display:block; font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; }
        .icon-left { position:absolute; left:13px; top:50%; transform:translateY(-50%); font-size:14px; }
        .btn-primary { width:100%; padding:14px; background:#007AFF; color:white; font-weight:700; border-radius:12px; font-size:15px; transition:all 0.15s; box-shadow:0 2px 8px rgba(0,122,255,0.2); display:flex; align-items:center; justify-content:center; gap:8px; }
        .btn-primary:hover:not(:disabled) { background:#0069d9; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .err-box { background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:12px 16px; font-size:13px; color:#dc2626; }
        .ok-box  { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:12px 16px; font-size:13px; color:#16a34a; }
      `}</style>
    </div>
  )
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
}
