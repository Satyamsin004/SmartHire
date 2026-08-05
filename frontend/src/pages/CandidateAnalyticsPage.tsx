import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Activity, Award, FileText, Briefcase, Clock, Target, ArrowUpRight, ArrowDownRight, MessageSquare, Shield, Brain, Trophy } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../services/api';

const CHART_COLORS = ['#4F46E5', '#818CF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#60A5FA'];

export const CandidateAnalyticsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>({
    charts: { ats_trend: [], interview_score_trend: [], readiness_trend: [] },
    funnel: { applied: 0, ats_passed: 0, interview_completed: 0, offers: 0, accepted: 0 },
    offer_funnel: { received: 0, pending: 0, accepted: 0, rejected: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/candidate-metrics')
      .then((res) => { if (res.data) setMetrics(res.data); })
      .catch((err) => console.warn('Fetch metrics error:', err))
      .finally(() => setLoading(false));
  }, []);

  const atsTrend = metrics.charts?.ats_trend || [];
  const interviewTrend = metrics.charts?.interview_score_trend || [];
  const readinessTrend = metrics.charts?.readiness_trend || [];

  // Funnel data for pie chart
  const funnelData = [
    { name: 'Applied', value: metrics.funnel?.applied || 0 },
    { name: 'ATS Passed', value: metrics.funnel?.ats_passed || 0 },
    { name: 'Interview Done', value: metrics.funnel?.interview_completed || 0 },
    { name: 'Offers', value: metrics.funnel?.offers || 0 },
    { name: 'Accepted', value: metrics.funnel?.accepted || 0 },
  ].filter(d => d.value > 0);

  const offerFunnel = [
    { name: 'Received', value: metrics.offer_funnel?.received || 0 },
    { name: 'Pending', value: metrics.offer_funnel?.pending || 0 },
    { name: 'Accepted', value: metrics.offer_funnel?.accepted || 0 },
    { name: 'Rejected', value: metrics.offer_funnel?.rejected || 0 },
  ].filter(d => d.value > 0);

  const StatCard = ({ label, value, icon: Icon, trend, color }: { label: string; value: string | number; icon: any; trend?: string; color: string }) => (
    <div className="card-luxury p-5 flex flex-col justify-between space-y-3">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-[10px] font-bold ${trend.startsWith('+') ? 'text-emerald-600' : trend.startsWith('-') ? 'text-rose-600' : 'text-slate-400'}`}>
            {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : trend.startsWith('-') ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-brand-ink">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );

  const successRate = metrics.app_success_rate || 0;
  const interviewRate = metrics.interview_success_rate || 0;
  const avgAts = Math.round(metrics.avg_ats_score || 0);
  const avgInterview = Math.round(metrics.avg_interview_score || 0);

  return (
    <>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Analytics & Insights</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Track your recruitment performance with real-time data from PostgreSQL.</p>
        </div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Jobs Applied" value={metrics.jobs_applied || 0} icon={Briefcase} color="bg-indigo-100 text-indigo-600" />
          <StatCard label="Interviews Completed" value={metrics.interviews_completed || 0} icon={Activity} color="bg-emerald-100 text-emerald-600" />
          <StatCard label="Average ATS Score" value={`${avgAts}%`} icon={Target} color="bg-amber-100 text-amber-600" />
          <StatCard label="Average Interview Score" value={`${avgInterview}%`} icon={Award} color="bg-violet-100 text-violet-600" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Application Success Rate" value={`${Math.round(successRate)}%`} icon={TrendingUp} color="bg-cyan-100 text-cyan-600" />
          <StatCard label="Interview Success Rate" value={`${Math.round(interviewRate)}%`} icon={BarChart3} color="bg-pink-100 text-pink-600" />
          <StatCard label="Active Applications" value={metrics.active_applications || 0} icon={FileText} color="bg-orange-100 text-orange-600" />
          <StatCard label="Readiness Score" value={`${Math.round(metrics.readiness_score || 0)}%`} icon={Target} color="bg-teal-100 text-teal-600" />
        </div>

        {/* Competency Averages Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Avg Communication" value={`${Math.round(metrics.avg_communication_score || 0)}%`} icon={MessageSquare} color="bg-indigo-100 text-indigo-600" />
          <StatCard label="Avg Confidence" value={`${Math.round(metrics.avg_confidence_score || 0)}%`} icon={Shield} color="bg-emerald-100 text-emerald-600" />
          <StatCard label="Avg Technical" value={`${Math.round(metrics.avg_technical_score || 0)}%`} icon={Brain} color="bg-amber-100 text-amber-600" />
          <StatCard label="Avg Professionalism" value={`${Math.round(metrics.avg_professionalism_score || 0)}%`} icon={Trophy} color="bg-violet-100 text-violet-600" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ATS Score Trend */}
          <div className="card-luxury p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">ATS Score Trend</h3>
              <span className="text-[10px] font-bold text-slate-400">{atsTrend.length} data points</span>
            </div>
            <div className="h-52">
              {atsTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={atsTrend}>
                    <defs>
                      <linearGradient id="atsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="job" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="score" stroke="#4F46E5" fill="url(#atsGrad)" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No ATS data yet. Apply to jobs to generate scores.</div>
              )}
            </div>
          </div>

          {/* Interview Score Trend */}
          <div className="card-luxury p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Interview Score Trend</h3>
              <span className="text-[10px] font-bold text-slate-400">{interviewTrend.length} sessions</span>
            </div>
            <div className="h-52">
              {interviewTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={interviewTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="score" stroke="#34D399" strokeWidth={2.5} dot={{ fill: '#34D399', r: 4, strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No interview data yet. Complete interviews to track scores.</div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application Funnel */}
          <div className="card-luxury p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Application Funnel</h3>
            <div className="h-52">
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={funnelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {funnelData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No funnel data yet.</div>
              )}
            </div>
          </div>

          {/* Readiness Score Trend */}
          <div className="card-luxury p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Readiness Trend</h3>
            <div className="h-52">
              {readinessTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={readinessTrend}>
                    <defs>
                      <linearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="score" stroke="#34D399" fill="url(#readinessGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No readiness data yet.</div>
              )}
            </div>
          </div>

          {/* Offer Breakdown */}
          <div className="card-luxury p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Offer Breakdown</h3>
            <div className="h-52">
              {offerFunnel.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={offerFunnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} width={70} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Bar dataKey="value" fill="#818CF8" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No offers yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-luxury p-6 space-y-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-200">Pipeline Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">Total Applied</span><span>{metrics.jobs_applied}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">ATS Passed</span><span>{metrics.ats_passed}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">ATS Rejected</span><span>{metrics.ats_rejected}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">Under Review</span><span>{metrics.active_applications}</span></div>
            </div>
          </div>

          <div className="card-luxury p-6 space-y-4 bg-gradient-to-br from-emerald-900 to-slate-900 text-white">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">Interview Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Scheduled</span><span>{metrics.interviews_scheduled}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Completed</span><span>{metrics.interviews_completed}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Best Score</span><span>{metrics.best_interview_score}%</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Avg Score</span><span>{avgInterview}%</span></div>
            </div>
          </div>

          <div className="card-luxury p-6 space-y-4 bg-gradient-to-br from-violet-900 to-slate-900 text-white">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-200">Career Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Days Active</span><span>{metrics.days_active}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Total Offers</span><span>{metrics.total_offers}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Profile %</span><span>{Math.round(metrics.profile_completion || 0)}%</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Resume v{metrics.resume_version || 1}</span><span>{metrics.skills_extracted} skills</span></div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {metrics.recent_activity && metrics.recent_activity.length > 0 && (
          <div className="card-luxury p-6 space-y-4">
            <h3 className="text-xs font-extrabold text-brand-ink uppercase tracking-wider">Recent Activity</h3>
            <div className="space-y-3">
              {metrics.recent_activity.map((act: any, i: number) => (
                <div key={act.id || i} className="flex items-start gap-3 p-3 rounded-xl bg-cream-100 border border-stoneBorder hover:border-indigo-200 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-ink">{act.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{act.message}</p>
                  </div>
                  {act.created_at && (
                    <span className="text-[9px] font-bold text-slate-300 shrink-0">
                      {new Date(act.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
};
