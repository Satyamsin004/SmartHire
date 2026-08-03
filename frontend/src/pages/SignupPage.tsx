import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, Building, Briefcase, ChevronRight, Check } from 'lucide-react';
import api from '../services/api';
import { LoginLandingIllustration } from '../components/illustrations/Illustrations';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'candidate' | 'recruiter' | 'admin'>('candidate');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [companyName, setCompanyName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!fullName || !email || !password) {
        setError('Please fill in all personal details.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/register', {
        email,
        password,
        full_name: fullName,
        role,
        target_role: role === 'candidate' ? targetRole : undefined,
        company_name: role === 'recruiter' ? companyName : undefined,
      });

      // Auto login after registration
      const loginRes = await api.post('/auth/login', { email, password });
      const { user, tokens } = loginRes.data;
      const accessToken = tokens?.access_token || loginRes.data.access_token;
      const refreshToken = tokens?.refresh_token || loginRes.data.refresh_token;

      localStorage.setItem('access_token', accessToken);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_data', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', accessToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      if (user.role === 'recruiter') {
        navigate('/recruiter');
      } else if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }

      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Registration failed. Please check details.');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 lg:p-8 font-sans">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white rounded-5xl shadow-floating border border-stoneBorder overflow-hidden min-h-[700px]">
        
        {/* Left Side Hero Banner */}
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
              Join Next-Generation AI Recruitment Platform
            </h1>
            <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-md">
              Create your enterprise account in seconds to access voice AI interviews, ATS resume parsing, and automated recruitment pipelines.
            </p>
          </div>

          <div className="my-8 relative z-10 max-w-md mx-auto">
            <LoginLandingIllustration className="w-full h-auto drop-shadow-2xl" />
          </div>

          {/* Stepper Progress */}
          <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-bold">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-brand-accent' : 'text-slate-400'}`}>
              <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
              <span>Account Role</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-brand-accent' : 'text-slate-400'}`}>
              <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
              <span>Credentials</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-brand-accent' : 'text-slate-400'}`}>
              <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
              <span>Profile Details</span>
            </div>
          </div>
        </div>

        {/* Right Side Onboarding Form */}
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-center bg-white/80 backdrop-blur-xl">
          
          <div className="max-w-md mx-auto w-full space-y-6">
            
            <div>
              <span className="px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase bg-brand-accent/40 text-brand-primary">
                Step {step} of 3
              </span>
              <h2 className="text-2xl font-extrabold text-brand-ink mt-2">
                {step === 1 && 'Select Your Account Type'}
                {step === 2 && 'Enter Account Credentials'}
                {step === 3 && 'Complete Your Profile Details'}
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                {step === 1 && 'Choose how you intend to utilize SmartHire AI Platform.'}
                {step === 2 && 'Provide your name, work email, and secure password.'}
                {step === 3 && 'Finalize profile specifications before joining.'}
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleNext} className="space-y-5">
              
              {/* STEP 1: ROLE SELECTION */}
              {step === 1 && (
                <div className="space-y-3">
                  <div
                    onClick={() => setRole('candidate')}
                    className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                      role === 'candidate' ? 'bg-emerald-50/50 border-brand-primary' : 'bg-cream-100 border-stoneBorder hover:border-slate-300'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-bold">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-extrabold text-brand-ink">Candidate Account</h4>
                      <p className="text-xs text-slate-500 font-medium">Apply for jobs, upload resume PDF, and take AI mock interviews.</p>
                    </div>
                    {role === 'candidate' && <CheckCircle2 className="w-6 h-6 text-brand-primary" />}
                  </div>

                  <div
                    onClick={() => setRole('recruiter')}
                    className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                      role === 'recruiter' ? 'bg-emerald-50/50 border-brand-primary' : 'bg-cream-100 border-stoneBorder hover:border-slate-300'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-brand-secondary text-white flex items-center justify-center font-bold">
                      <Building className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-extrabold text-brand-ink">Recruiter Account</h4>
                      <p className="text-xs text-slate-500 font-medium">Post job requisitions, review ATS scores, and schedule candidate rounds.</p>
                    </div>
                    {role === 'recruiter' && <CheckCircle2 className="w-6 h-6 text-brand-primary" />}
                  </div>
                </div>
              )}

              {/* STEP 2: PERSONAL DETAILS */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-cream-100 border border-stoneBorder rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-cream-100 border border-stoneBorder rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-cream-100 border border-stoneBorder rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: PROFESSIONAL DETAILS */}
              {step === 3 && (
                <div className="space-y-4">
                  {role === 'candidate' ? (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Primary Target Role</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Senior Backend Systems Engineer"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Company Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SmartHire AI Corporate"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold leading-relaxed">
                    By registering, you agree to SmartHire AI's Enterprise Platform Terms of Service and Privacy Policy.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-6 py-3 rounded-2xl bg-cream-200 hover:bg-stoneBorder text-brand-ink text-xs font-extrabold"
                  >
                    Back
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3.5 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury transition-all disabled:opacity-50"
                >
                  <span>{loading ? 'Registering...' : step === 3 ? 'Complete Registration' : 'Continue Step'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </form>

            <div className="text-center pt-4 border-t border-stoneBorder/60">
              <p className="text-xs text-slate-500 font-semibold">
                Already have an account?{' '}
                <Link to="/login" className="font-extrabold text-brand-primary hover:underline">
                  Sign In Now
                </Link>
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
