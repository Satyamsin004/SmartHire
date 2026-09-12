import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sparkles, Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, 
  KeyRound, X, Check, Eye, EyeOff, Briefcase, Shield, UserCheck, Activity, Zap 
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoginLandingIllustration, SignupOnboardingIllustration } from '../components/illustrations/Illustrations';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setAuthSession } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<'candidate' | 'recruiter' | 'admin'>('candidate');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Persistent Error State - NEVER clears automatically on re-render or loading end
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; fullName?: string }>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);


  // Forgot Password Modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  // Handle Google OAuth Callback URL Parameters on Mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    const userParam = params.get('user');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (tokenParam) {
      const processOAuthSession = async () => {
        try {
          let userObj: any = null;
          if (userParam) {
            try {
              userObj = JSON.parse(decodeURIComponent(userParam));
            } catch (parseErr) {
              console.warn('Could not parse user param directly, will fetch /users/me:', parseErr);
            }
          }

          // If userObj was not provided or failed parsing, fetch from /users/me
          if (!userObj || !userObj.id) {
            const meRes = await api.get('/users/me', {
              headers: { Authorization: `Bearer ${tokenParam}` }
            });
            userObj = meRes.data;
          }

          // Determine user's actual role and sync role state
          if (userObj && userObj.role && ['candidate', 'recruiter', 'admin'].includes(userObj.role)) {
            setRole(userObj.role as any);
          }

          // Store auth session exactly as standard authentication expects
          setAuthSession(userObj, tokenParam);

          // Remove token and user credentials from the visible browser URL bar
          window.history.replaceState({}, document.title, window.location.pathname);

          setSuccessToast(`Welcome back, ${userObj.full_name || 'User'}!`);

          // Redirect to appropriate role workspace
          const targetPath = userObj.role === 'recruiter'
            ? '/recruiter'
            : userObj.role === 'admin'
              ? '/admin'
              : '/dashboard';

          setTimeout(() => {
            navigate(targetPath, { replace: true });
          }, 800);
        } catch (e: any) {
          console.error('Failed to process Google OAuth session:', e);
          setError(e.response?.data?.detail || 'Failed to complete Google Sign-In. Please try again.');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };

      processOAuthSession();
    }
  }, [location.search]);

  // Password Strength Calculation Helper
  const getPasswordStrength = (pwd: string): { label: 'Weak' | 'Medium' | 'Strong'; color: string; percent: number } => {
    if (!pwd) return { label: 'Weak', color: 'bg-rose-500', percent: 0 };
    if (pwd.length < 8) return { label: 'Weak', color: 'bg-rose-500', percent: 33 };
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasNumbers = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);

    if (pwd.length >= 8 && hasLetters && hasNumbers && hasSpecial && hasUpper) {
      return { label: 'Strong', color: 'bg-emerald-500', percent: 100 };
    }
    if (pwd.length >= 8 && (hasLetters && hasNumbers)) {
      return { label: 'Medium', color: 'bg-amber-500', percent: 66 };
    }
    return { label: 'Weak', color: 'bg-rose-500', percent: 33 };
  };

  // Input Change Handlers - Clear ONLY the field error being edited
  const handleEmailChange = (val: string) => {
    setEmail(val);
    setError(null);
    setFieldErrors(prev => ({ ...prev, email: undefined }));
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setError(null);
    setFieldErrors(prev => ({ ...prev, password: undefined }));
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    setError(null);
    setFieldErrors(prev => ({ ...prev, confirmPassword: undefined }));
  };

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    setError(null);
    setFieldErrors(prev => ({ ...prev, fullName: undefined }));
  };

  // Client-Side Validation
  const validateForm = (): boolean => {
    const errs: { email?: string; password?: string; confirmPassword?: string; fullName?: string } = {};
    let isValid = true;

    if (isSignup && !fullName.trim()) {
      errs.fullName = 'Full name is required.';
      isValid = false;
    }
    if (!email.trim()) {
      errs.email = 'Email is required.';
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errs.email = 'Please enter a valid email address.';
        isValid = false;
      }
    }

    if (!password) {
      errs.password = 'Password is required.';
      isValid = false;
    } else if (password.length < 8) {
      errs.password = 'Password must contain at least 8 characters.';
      isValid = false;
    }

    if (isSignup && password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
      isValid = false;
    }

    setFieldErrors(errs);

    if (!isValid) {
      if (errs.email) setError(errs.email);
      else if (errs.password) setError(errs.password);
      else if (errs.confirmPassword) setError(errs.confirmPassword);
      else if (errs.fullName) setError(errs.fullName);
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isSignup) {
        await api.post('/auth/register', {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
        });
      }

      const loginRes = await api.post('/auth/login', { email: email.trim(), password });
      const { user, tokens } = loginRes.data;

      // Role Mismatch Validation
      if (user.role !== role) {
        const actualRoleName = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        setError(`This account is registered as a ${actualRoleName}. Please select the ${actualRoleName} portal workspace.`);
        setLoading(false);
        return;
      }

      const accessToken = tokens?.access_token || loginRes.data.access_token;
      const refreshToken = tokens?.refresh_token || loginRes.data.refresh_token;

      setAuthSession(user, accessToken, refreshToken);

      setError(null);
      setSuccessMsg("Login successful.");
      setSuccessToast(`Welcome back, ${user.full_name || 'User'}!`);

      setTimeout(() => {
        if (user.role === 'recruiter') {
          navigate('/recruiter', { replace: true });
        } else if (user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 1000);

    } catch (err: any) {
      console.error('Authentication Error:', err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 401) {
        setError('Invalid email or password.');
      } else if (status === 404) {
        setError('Account not found. Please register first.');
      } else if (status === 409) {
        setError(isSignup ? 'An account with this email already exists.' : 'Role mismatch. Please log in using the correct portal workspace.');
      } else if (status === 403) {
        setError('Your account has been blocked. Please contact support.');
      } else if (status === 423) {
        setError('Account temporarily locked due to multiple failed login attempts.');
      } else if (status === 429) {
        setError('Too many login attempts. Please try again later.');
      } else if (status === 500) {
        setError('Something went wrong. Please try again.');
      } else {
        setError(detail || 'Authentication failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError(null);
    const backendBase = api.defaults.baseURL || '/api/v1';
    window.location.href = `${backendBase}/auth/google/login?role=${role}`;
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg(null);

    if (!forgotEmail.trim()) {
      setForgotMsg('Please enter your email address.');
      setForgotLoading(false);
      return;
    }

    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      setForgotMsg('If the email is registered, password reset instructions have been sent.');
    } finally {
      setForgotLoading(false);
    }
  };

  const isFormDisabled = loading || googleLoading;

  return (
    <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-4 lg:p-8 font-sans relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* Ambient Cosmic Background Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:28px_28px] opacity-25 pointer-events-none" />
      <div className="absolute -top-36 -left-36 w-[520px] h-[520px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-[520px] h-[520px] bg-purple-600/18 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-600/8 rounded-full blur-[180px] pointer-events-none" />

      {/* Success Toast Notification Banner - Visible for 2.5s */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl bg-indigo-600/95 text-white shadow-[0_10px_30px_rgba(79,70,229,0.4)] border border-indigo-400/50 backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-indigo-200 shrink-0" />
          <span className="text-xs font-bold tracking-wide">{successToast}</span>
        </div>
      )}

      {/* Main Glassmorphic Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl lg:rounded-[2.5rem] bg-[#0E1526]/90 border border-slate-700/60 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.8),0_0_50px_-10px_rgba(99,102,241,0.18)] backdrop-blur-2xl overflow-hidden min-h-[720px] relative z-10">
        
        {/* Top Highlight Rim Light */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 via-purple-400/40 to-transparent pointer-events-none z-20" />

        {/* Left Side: Deep Indigo Storytelling Hero */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#0c1022] via-[#0f172a] to-[#080c16] p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/80">
          <div className="absolute -top-12 -right-12 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            {/* Brand Logo & Version Badge */}
            <div className="flex items-center justify-between gap-3 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-extrabold shadow-[0_0_20px_rgba(99,102,241,0.45)] ring-1 ring-white/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xl font-black tracking-tight text-white block">SmartHire AI</span>
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Talent Intelligence</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold backdrop-blur-sm shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span>Enterprise AI Active</span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.15] mb-4">
              Enterprise Talent Acquisition{" "}
              <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 drop-shadow-sm">
                Powered by Intelligence
              </span>
            </h1>
            <p className="text-sm text-slate-300/90 font-medium leading-relaxed max-w-md">
              Automated ATS screening, voice-enabled AI interviews, and deterministic candidate evaluation reports — all powered by real telemetry data.
            </p>
          </div>

          {/* Centerpiece Vector Illustration with Floating Holographic Badges */}
          <div className="my-6 relative z-10 max-w-md mx-auto w-full">
            {/* Ambient Backlight for Illustration */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent rounded-3xl blur-2xl pointer-events-none" />

            {/* Floating Live Telemetry Chip - Top Right */}
            <div className="hidden sm:flex absolute -top-3 -right-2 z-20 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-indigo-500/40 shadow-xl shadow-indigo-950/60 backdrop-blur-md items-center gap-2.5 animate-float-slow">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Gemini 1.5 Pro</span>
                <span className="text-[9px] font-semibold text-slate-400">Smart Audit Active</span>
              </div>
            </div>

            {/* The Illustration */}
            <div className="relative z-10 p-2">
              {isSignup ? (
                <SignupOnboardingIllustration className="w-full h-auto drop-shadow-2xl max-h-[250px]" />
              ) : (
                <LoginLandingIllustration className="w-full h-auto drop-shadow-2xl max-h-[250px]" />
              )}
            </div>

            {/* Floating Metric Chip - Bottom Left */}
            <div className="hidden sm:flex absolute -bottom-3 -left-2 z-20 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-xl shadow-purple-950/60 backdrop-blur-md items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-black text-white">98.4% Match Accuracy</span>
                <span className="text-[9px] font-semibold text-slate-400">Zero Fabricated Data</span>
              </div>
            </div>
          </div>

          {/* Trust Highlights Bottom Row */}
          <div className="relative z-10 grid grid-cols-2 gap-3 pt-6 border-t border-slate-800/80">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">Zero Fabricated Data</span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200">PostgreSQL Verified</span>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-center bg-[#0F172A]/75 backdrop-blur-xl relative">
          <div className="max-w-md mx-auto w-full space-y-6">
            
            {/* Header Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isSignup ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              <p className="text-xs font-medium text-slate-400">
                {isSignup 
                  ? 'Join SmartHire AI for verified intelligence and assessment' 
                  : 'Enter your credentials to access your portal workspace'}
              </p>
            </div>

            {/* Tabbed Auth Switch */}
            <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
              <button
                type="button"
                disabled={isFormDisabled}
                onClick={() => { setIsSignup(false); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                  !isSignup 
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                disabled={isFormDisabled}
                onClick={() => { setIsSignup(true); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer ${
                  isSignup 
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Success Banner Message */}
            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs font-bold flex items-center gap-2.5 animate-in fade-in shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Persistent Banner Error Message */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-in fade-in shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Role Selector Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
                  Select Portal Workspace
                </label>
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/80">
                  {role === 'candidate' ? 'Candidate Workspace' : role === 'recruiter' ? 'Recruiter Workspace' : 'System Admin'}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2.5">
                {([
                  { id: 'candidate', label: 'Candidate', icon: UserCheck },
                  { id: 'recruiter', label: 'Recruiter', icon: Briefcase },
                  { id: 'admin', label: 'Admin', icon: Shield },
                ] as const).map(({ id: r, label, icon: Icon }) => (
                  <button
                    key={r}
                    type="button"
                    disabled={isFormDisabled}
                    onClick={() => { setRole(r); }}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                      role === r
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white border-indigo-500 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-500/20'
                        : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${role === r ? 'text-white' : 'text-slate-400'}`} />
                    <span className="capitalize">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Inputs */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative group">
                    <User className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled={isFormDisabled}
                      value={fullName}
                      onChange={(e) => handleFullNameChange(e.target.value)}
                      placeholder="Jane Doe"
                      className={`w-full bg-slate-900/80 border rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all ${
                        fieldErrors.fullName 
                          ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/30' 
                          : 'border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                      }`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="text-[11px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors.fullName}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address</label>
                <div className="relative group">
                  <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled={isFormDisabled}
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="name@company.com"
                    className={`w-full bg-slate-900/80 border rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all ${
                      fieldErrors.email 
                        ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/30' 
                        : 'border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                  {!isSignup && (
                    <button
                      type="button"
                      disabled={isFormDisabled}
                      onClick={() => { setShowForgotModal(true); setForgotMsg(null); }}
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    disabled={isFormDisabled}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full bg-slate-900/80 border rounded-2xl pl-10 pr-10 py-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all ${
                      fieldErrors.password 
                        ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/30' 
                        : 'border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.password}
                  </p>
                )}
                {isSignup && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <span>Password Strength</span>
                      <span className={getPasswordStrength(password).label === 'Strong' ? 'text-emerald-400' : getPasswordStrength(password).label === 'Medium' ? 'text-amber-400' : 'text-rose-400'}>
                        {getPasswordStrength(password).label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getPasswordStrength(password).color}`}
                        style={{ width: `${getPasswordStrength(password).percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {isSignup && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      disabled={isFormDisabled}
                      value={confirmPassword}
                      onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full bg-slate-900/80 border rounded-2xl pl-10 pr-10 py-3 text-xs font-bold text-white placeholder-slate-500 focus:outline-none transition-all ${
                        fieldErrors.confirmPassword 
                          ? 'border-rose-500 bg-rose-950/20 ring-1 ring-rose-500/30' 
                          : 'border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-[11px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              )}

              {!isSignup && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    disabled={isFormDisabled}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <label htmlFor="rememberMe" className="text-xs font-medium text-slate-300 cursor-pointer select-none">
                    Remember my login session
                  </label>
                </div>
              )}

              {/* Submit Login Button */}
              <button
                type="submit"
                disabled={isFormDisabled}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_28px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 mt-4 cursor-pointer group"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <span>{isSignup ? 'Complete Registration' : 'Access Portal Workspace'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider OR */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OR</span>
              <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1" />
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              disabled={isFormDisabled}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 font-extrabold text-xs flex items-center justify-center gap-3 shadow-sm hover:shadow transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 cursor-pointer"
            >
              {googleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Google...</span>
                </div>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0E1526] rounded-3xl p-6 border border-slate-700/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] w-full max-w-md space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <span>Reset Password</span>
              </div>
              <button onClick={() => setShowForgotModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Enter your account email address below to receive password reset instructions.
            </p>

            {forgotMsg && (
              <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs font-bold">
                {forgotMsg}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-extrabold hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold shadow-md disabled:opacity-50 transition-all cursor-pointer"
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Instructions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

