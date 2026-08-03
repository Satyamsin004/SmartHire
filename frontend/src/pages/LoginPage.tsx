import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, KeyRound, X, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoginLandingIllustration } from '../components/illustrations/Illustrations';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<'candidate' | 'recruiter' | 'admin'>('candidate');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Persistent Error State - NEVER clears automatically on re-render or loading end
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
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
    } else if (tokenParam && userParam) {
      try {
        const userObj = JSON.parse(decodeURIComponent(userParam));
        if (userObj.role !== role) {
          setError(`This account is registered as a ${userObj.role.charAt(0).toUpperCase() + userObj.role.slice(1)}. Please select the ${userObj.role.charAt(0).toUpperCase() + userObj.role.slice(1)} portal workspace.`);
          return;
        }

        localStorage.setItem('access_token', tokenParam);
        localStorage.setItem('user_data', JSON.stringify(userObj));
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('token', tokenParam);
        api.defaults.headers.common['Authorization'] = `Bearer ${tokenParam}`;

        setSuccessToast(`Welcome back, ${userObj.full_name || 'User'}!`);
        // 2.5 seconds visible toast before redirect
        setTimeout(() => {
          if (userObj.role === 'recruiter') navigate('/recruiter');
          else if (userObj.role === 'admin') navigate('/admin');
          else navigate('/dashboard');
          window.location.reload();
        }, 2500);
      } catch (e) {
        console.error('Failed to parse Google OAuth user payload:', e);
      }
    }
  }, [location.search]);

  // Input Change Handlers - Clear Error ONLY when user types!
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

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    setError(null);
    setFieldErrors(prev => ({ ...prev, fullName: undefined }));
  };

  // Client-Side Validation
  const validateForm = (): boolean => {
    const errs: { email?: string; password?: string; fullName?: string } = {};
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
      if (!emailRegex.test(email)) {
        errs.email = 'Please enter a valid email address.';
        isValid = false;
      }
    }

    if (!password) {
      errs.password = 'Password is required.';
      isValid = false;
    }

    setFieldErrors(errs);

    if (!isValid) {
      if (errs.email) setError(errs.email);
      else if (errs.password) setError(errs.password);
      else if (errs.fullName) setError(errs.fullName);
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isSignup) {
        await api.post('/auth/register', {
          email,
          password,
          full_name: fullName,
          role,
        });
      }

      const loginRes = await api.post('/auth/login', { email, password });
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

      localStorage.setItem('access_token', accessToken);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_data', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', accessToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setSuccessToast(`Welcome back, ${user.full_name || 'User'}!`);

      // Keep toast visible for 2.5 seconds before redirecting
      setTimeout(() => {
        if (user.role === 'recruiter') {
          navigate('/recruiter');
        } else if (user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
        window.location.reload();
      }, 2500);

    } catch (err: any) {
      console.error('Authentication Error:', err);
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 401) {
        setError('Invalid email or password.');
      } else if (status === 404) {
        setError('User account not found.');
      } else if (status === 403) {
        setError('Your account has been blocked. Please contact support.');
      } else if (status === 409) {
        setError('Role mismatch. Please log in using the correct portal workspace.');
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
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 lg:p-8 font-sans relative">
      
      {/* Success Toast Notification Banner - Visible for 2.5s */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-800 text-white shadow-2xl border border-emerald-500 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" />
          <span className="text-xs font-extrabold">{successToast}</span>
        </div>
      )}

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white rounded-5xl shadow-floating border border-stoneBorder overflow-hidden min-h-[700px]">
        
        {/* Left Side: Deep Emerald Storytelling Hero */}
        <div className="lg:col-span-6 bg-gradient-to-br from-brand-primary via-sb-800 to-brand-ink p-8 lg:p-12 text-brand-bg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-secondary/20 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-brand-accent text-brand-primary flex items-center justify-center font-extrabold shadow-luxury">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">SmartHire AI</span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
              Enterprise Talent Acquisition Powered by Gemini 1.5 Pro
            </h1>
            <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-md">
              Automated ATS screening, voice-enabled AI interviews, and deterministic candidate evaluation reports — all powered by real data.
            </p>
          </div>

          {/* Embedded Vector Illustration */}
          <div className="my-8 relative z-10 max-w-md mx-auto">
            <LoginLandingIllustration className="w-full h-auto drop-shadow-2xl" />
          </div>

          {/* Trust Highlights */}
          <div className="relative z-10 grid grid-cols-2 gap-4 pt-6 border-t border-sb-700/60">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
              <span className="text-xs font-bold text-slate-200">Zero Fabricated Data</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-brand-accent shrink-0" />
              <span className="text-xs font-bold text-slate-200">PostgreSQL Verified</span>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Glass Card */}
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full space-y-6">
            
            {/* Tabbed Auth Switch */}
            <div className="flex bg-cream-200 p-1.5 rounded-3xl border border-stoneBorder">
              <button
                type="button"
                disabled={isFormDisabled}
                onClick={() => { setIsSignup(false); }}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all disabled:opacity-50 ${
                  !isSignup ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink hover:text-brand-primary'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                disabled={isFormDisabled}
                onClick={() => { setIsSignup(true); }}
                className={`flex-1 py-2.5 text-xs font-extrabold rounded-2xl transition-all disabled:opacity-50 ${
                  isSignup ? 'bg-brand-primary text-white shadow-soft' : 'text-brand-ink hover:text-brand-primary'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Persistent Banner Error Message (Stays visible until input edit) */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Role Selector Cards */}
            <div>
              <label className="block text-[11px] font-extrabold text-brand-ink mb-2 uppercase tracking-wider">Select Portal Workspace</label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['candidate', 'recruiter', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={isFormDisabled}
                    onClick={() => { setRole(r); }}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold border transition-all capitalize disabled:opacity-50 ${
                      role === r
                        ? 'bg-brand-primary text-white border-brand-primary shadow-soft'
                        : 'bg-cream-100 text-brand-ink border-stoneBorder hover:bg-cream-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Inputs (EMAIL & PASSWORD FIRST) */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <div>
                  <label className="block text-xs font-bold text-brand-ink mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled={isFormDisabled}
                      value={fullName}
                      onChange={(e) => handleFullNameChange(e.target.value)}
                      placeholder="Jane Doe"
                      className={`w-full bg-cream-100 border rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-brand-ink focus:outline-none transition-all ${
                        fieldErrors.fullName ? 'border-rose-500 bg-rose-50/30' : 'border-stoneBorder focus:border-brand-primary'
                      }`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1">{fieldErrors.fullName}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-brand-ink mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled={isFormDisabled}
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="name@company.com"
                    className={`w-full bg-cream-100 border rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-brand-ink focus:outline-none transition-all ${
                      fieldErrors.email ? 'border-rose-500 bg-rose-50/30' : 'border-stoneBorder focus:border-brand-primary'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-brand-ink">Password</label>
                  {!isSignup && (
                    <button
                      type="button"
                      disabled={isFormDisabled}
                      onClick={() => { setShowForgotModal(true); setForgotMsg(null); }}
                      className="text-[11px] font-bold text-brand-primary hover:underline disabled:opacity-50"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    disabled={isFormDisabled}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full bg-cream-100 border rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-brand-ink focus:outline-none transition-all ${
                      fieldErrors.password ? 'border-rose-500 bg-rose-50/30' : 'border-stoneBorder focus:border-brand-primary'
                    }`}
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              {!isSignup && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    disabled={isFormDisabled}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-stoneBorder text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="rememberMe" className="text-xs font-semibold text-slate-600 cursor-pointer">
                    Remember my login session
                  </label>
                </div>
              )}

              {/* Submit Login Button */}
              <button
                type="submit"
                disabled={isFormDisabled}
                className="w-full py-3.5 px-6 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-luxury transition-all disabled:opacity-50 mt-4"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <span>{isSignup ? 'Complete Registration' : 'Access Portal Workspace'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider OR */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px bg-stoneBorder flex-1" />
              <span className="text-[11px] font-bold text-slate-400 uppercase">OR</span>
              <div className="h-px bg-stoneBorder flex-1" />
            </div>

            {/* Google OAuth Button BELOW EMAIL FORM (Standard UX Pattern) */}
            <button
              type="button"
              disabled={isFormDisabled}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-cream-100 text-slate-700 border border-stoneBorder font-extrabold text-xs flex items-center justify-center gap-3 shadow-soft transition-all disabled:opacity-50"
            >
              {googleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-stoneBorder shadow-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-stoneBorder pb-3">
              <div className="flex items-center gap-2 text-brand-ink font-extrabold">
                <KeyRound className="w-5 h-5 text-brand-primary" />
                <span>Reset Password</span>
              </div>
              <button onClick={() => setShowForgotModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Enter your account email address below to receive password reset instructions.
            </p>

            {forgotMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                {forgotMsg}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-cream-100 border border-stoneBorder rounded-xl px-3.5 py-2.5 text-xs font-bold text-brand-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 rounded-xl bg-cream-200 text-slate-700 text-xs font-extrabold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-extrabold shadow-luxury disabled:opacity-50"
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
