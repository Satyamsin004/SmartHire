import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Activity, Award, FileText, Briefcase, Clock, Target, ArrowUpRight, ArrowDownRight, MessageSquare, Shield, Brain, Trophy, AlertTriangle, ExternalLink, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

const CHART_COLORS = ['#4F46E5', '#818CF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#60A5FA'];

export const CandidateAnalyticsPage: React.FC = () => {
  const { lastMessage } = useWebSocket();
  const [metrics, setMetrics] = useState<any>({
    charts: { ats_trend: [], interview_score_trend: [], readiness_trend: [] },
    funnel: { applied: 0, ats_passed: 0, interview_completed: 0, offers: 0, accepted: 0 },
    offer_funnel: { received: 0, pending: 0, accepted: 0, rejected: 0 }
  });
  const [trendData, setTrendData] = useState<any>(null);
  const [weakAreasData, setWeakAreasData] = useState<any>(null);
  const [skillsData, setSkillsData] = useState<any>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [activeSkillCategory, setActiveSkillCategory] = useState<string>('All');
  const [showAllWeakAreas, setShowAllWeakAreas] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = () => {
    Promise.allSettled([
      api.get('/users/candidate-metrics'),
      api.get('/analytics/candidate/trends'),
      api.get('/analytics/candidate/weak-areas'),
      api.get('/analytics/candidate/skills'),
      api.get('/analytics/candidate/improvement-progress')
    ]).then(([metricsRes, trendsRes, weakRes, skillsRes, progressRes]) => {
      if (metricsRes.status === 'fulfilled' && metricsRes.value?.data) {
        setMetrics(metricsRes.value.data);
      }
      if (trendsRes.status === 'fulfilled' && trendsRes.value?.data) {
        setTrendData(trendsRes.value.data);
      }
      if (weakRes.status === 'fulfilled' && weakRes.value?.data) {
        setWeakAreasData(weakRes.value.data);
      }
      if (skillsRes.status === 'fulfilled' && skillsRes.value?.data) {
        setSkillsData(skillsRes.value.data);
      }
      if (progressRes.status === 'fulfilled' && progressRes.value?.data) {
        setProgressData(progressRes.value.data);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  // Listen for realtime domain events
  useEffect(() => {
    if (lastMessage) {
      loadAnalytics();
    }
  }, [lastMessage]);

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
    <div className="card-luxury p-5 flex flex-col justify-between space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color} dark:bg-opacity-20`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-[10px] font-bold ${trend.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : trend.startsWith('-') ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
            {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : trend.startsWith('-') ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-brand-ink dark:text-white">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
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
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Analytics & Insights</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Track your recruitment performance with real-time data from PostgreSQL.</p>
        </div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Jobs Applied" value={metrics.jobs_applied || 0} icon={Briefcase} color="bg-indigo-100 text-indigo-600 dark:text-indigo-400" />
          <StatCard label="Interviews Completed" value={metrics.interviews_completed || 0} icon={Activity} color="bg-emerald-100 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Average ATS Score" value={`${avgAts}%`} icon={Target} color="bg-amber-100 text-amber-600 dark:text-amber-400" />
          <StatCard label="Average Interview Score" value={`${avgInterview}%`} icon={Award} color="bg-violet-100 text-violet-600 dark:text-violet-400" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Application Success Rate" value={`${Math.round(successRate)}%`} icon={TrendingUp} color="bg-cyan-100 text-cyan-600 dark:text-cyan-400" />
          <StatCard label="Interview Success Rate" value={`${Math.round(interviewRate)}%`} icon={BarChart3} color="bg-pink-100 text-pink-600 dark:text-pink-400" />
          <StatCard label="Active Applications" value={metrics.active_applications || 0} icon={FileText} color="bg-orange-100 text-orange-600 dark:text-orange-400" />
          <StatCard label="Readiness Score" value={`${Math.round(metrics.readiness_score || 0)}%`} icon={Target} color="bg-teal-100 text-teal-600 dark:text-teal-400" />
        </div>

        {/* Competency Averages Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Avg Communication" value={`${Math.round(metrics.avg_communication_score || 0)}%`} icon={MessageSquare} color="bg-indigo-100 text-indigo-600 dark:text-indigo-400" />
          <StatCard label="Avg Confidence" value={`${Math.round(metrics.avg_confidence_score || 0)}%`} icon={Shield} color="bg-emerald-100 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Avg Technical" value={`${Math.round(metrics.avg_technical_score || 0)}%`} icon={Brain} color="bg-amber-100 text-amber-600 dark:text-amber-400" />
          <StatCard label="Avg Professionalism" value={`${Math.round(metrics.avg_professionalism_score || 0)}%`} icon={Trophy} color="bg-violet-100 text-violet-600 dark:text-violet-400" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ATS Score Trend */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">ATS Score Trend</h3>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#94A3B822" />
                    <XAxis dataKey="job" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="score" stroke="#4F46E5" fill="url(#atsGrad)" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No ATS data yet. Apply to jobs to generate scores.</div>
              )}
            </div>
          </div>

          {/* Interview Score Trend */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Interview Score Trend</h3>
              <span className="text-[10px] font-bold text-slate-400">{interviewTrend.length} sessions</span>
            </div>
            <div className="h-52">
              {interviewTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={interviewTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94A3B822" />
                    <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '12px' }} />
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
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Application Funnel</h3>
            <div className="h-52">
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={funnelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {funnelData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No funnel data yet.</div>
              )}
            </div>
          </div>

          {/* Readiness Score Trend */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Readiness Trend</h3>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#94A3B822" />
                    <XAxis dataKey="step" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="score" stroke="#34D399" fill="url(#readinessGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No readiness data yet.</div>
              )}
            </div>
          </div>

          {/* Offer Breakdown */}
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Offer Breakdown</h3>
            <div className="h-52">
              {offerFunnel.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={offerFunnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#94A3B822" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} width={70} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#0F172A', color: '#F8FAFC', fontSize: '12px' }} />
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
          <div className="card-luxury p-6 space-y-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl border border-indigo-800/40">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-200">Pipeline Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">Total Applied</span><span>{metrics.jobs_applied}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">ATS Passed</span><span>{metrics.ats_passed}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">ATS Rejected</span><span>{metrics.ats_rejected}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-indigo-200">Under Review</span><span>{metrics.active_applications}</span></div>
            </div>
          </div>

          <div className="card-luxury p-6 space-y-4 bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-3xl border border-emerald-800/40">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">Interview Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Scheduled</span><span>{metrics.interviews_scheduled}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Completed</span><span>{metrics.interviews_completed}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Best Score</span><span>{metrics.best_interview_score}%</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-emerald-200">Avg Score</span><span>{avgInterview}%</span></div>
            </div>
          </div>

          <div className="card-luxury p-6 space-y-4 bg-gradient-to-br from-violet-900 to-slate-900 text-white rounded-3xl border border-violet-800/40">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-200">Career Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Days Active</span><span>{metrics.days_active}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Total Offers</span><span>{metrics.total_offers}</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Profile %</span><span>{Math.round(metrics.profile_completion || 0)}%</span></div>
              <div className="flex justify-between text-sm font-bold"><span className="text-violet-200">Resume v{metrics.resume_version || 1}</span><span>{metrics.skills_extracted} skills</span></div>
            </div>
          </div>
        </div>

        {/* Recurring Weak Areas & AI Study Pathways */}
        {weakAreasData && (
          <div className="card-luxury p-6 space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Historical Weak-Area Analysis & Curated Resources</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Recurring weakness detection across completed interview sessions.</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {weakAreasData.weak_areas_count || 0} areas flagged
              </span>
            </div>

            {weakAreasData.weak_areas.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">No Recurring Weak Areas Detected</p>
                <p className="text-[11px] text-slate-400">Consistent technical and communication competencies maintained across your interviews.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(showAllWeakAreas ? weakAreasData.weak_areas : weakAreasData.weak_areas.slice(0, 12)).map((wa: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {wa.category}
                            </span>
                            <h4 className="text-sm font-black text-brand-ink dark:text-white mt-1">{wa.skill}</h4>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            wa.severity === 'high' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                            wa.severity === 'medium' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                            'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {wa.severity}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span>Occurrences: <strong className="text-slate-900 dark:text-white">{wa.weak_occurrences}x</strong></span>
                          <span>Avg: <strong className="text-slate-900 dark:text-white">{wa.average_score}%</strong></span>
                          <span className="capitalize">Trend: <strong className={wa.trend === 'improving' ? 'text-emerald-600 dark:text-emerald-400' : wa.trend === 'declining' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}>{wa.trend}</strong></span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                          {wa.recommendation}
                        </p>
                      </div>

                      {wa.resources && wa.resources.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-1">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Verified Resources</p>
                          {wa.resources.slice(0, 2).map((res: any, rIdx: number) => (
                            <a
                              key={rIdx}
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-1.5 rounded-md bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-bold transition-colors"
                            >
                              <span className="truncate pr-1">{res.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Expand / Collapse Button */}
                {weakAreasData.weak_areas.length > 12 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Showing <strong className="text-slate-900 dark:text-white">{showAllWeakAreas ? weakAreasData.weak_areas.length : 12}</strong> of <strong className="text-slate-900 dark:text-white">{weakAreasData.weak_areas.length}</strong> focus areas
                    </p>
                    <button
                      onClick={() => setShowAllWeakAreas(!showAllWeakAreas)}
                      className="px-5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-black flex items-center gap-2 transition-all shadow-xs hover:shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {showAllWeakAreas ? (
                        <>
                          <span>Show Less Focus Areas</span>
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <span>See More Focus Areas ({weakAreasData.weak_areas.length - 12} remaining)</span>
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Skill-Wise Analytics & Mastery Section */}
        {skillsData && (
          <div className="card-luxury p-6 space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-indigo-500" />
                  <span>Skill-Wise Competency Analytics</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Granular mastery ratings across {skillsData.total_skills_tracked || 0} evaluated skills and technologies.
                </p>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {['All', 'Technical', 'Communication', 'Behavior'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveSkillCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeSkillCategory === cat ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Skills Matrix */}
            {(!skillsData?.has_data || (skillsData.skills || []).length === 0) ? (
              <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <Brain className="w-10 h-10 text-indigo-400 mx-auto opacity-50" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Skill Telemetry Recorded Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Skill mastery scores will automatically generate once you complete your mock assessments or technical interview sessions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(skillsData.skills || [])
                  .filter((s: any) => activeSkillCategory === 'All' || s.category.toLowerCase() === activeSkillCategory.toLowerCase())
                  .map((sk: any, i: number) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-brand-ink dark:text-white">{sk.skill}</span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          sk.proficiency === 'Expert' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                          sk.proficiency === 'Proficient' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {sk.proficiency}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span>Mastery</span>
                          <span className="text-brand-ink dark:text-white font-black">{sk.score}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full transition-all duration-700" style={{ width: `${sk.score}%` }} />
                        </div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-200/60 dark:border-slate-700">
                        <span>Category: {sk.category}</span>
                        <span>Evaluated: {sk.observations_count}x</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* AI Feedback & Improvement Progress Section */}
        {progressData && (
          <div className="card-luxury p-6 space-y-6 bg-gradient-to-br from-indigo-950/80 via-slate-900 to-purple-950/80 text-white rounded-3xl border border-indigo-500/30 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                    AI COACHING TELEMETRY
                  </span>
                  {progressData.has_data && progressData.improvement_velocity !== undefined && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Velocity: +{progressData.improvement_velocity}% / session
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-white">Improvement Progress & Coaching Directives</h3>
              </div>
            </div>

            {!progressData.has_data || progressData.total_interviews === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <Sparkles className="w-8 h-8 text-indigo-300 mx-auto opacity-70" />
                <h4 className="text-sm font-bold text-white">No Coaching Telemetry Yet</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Complete your first mock assessment or interview to generate AI synthesis, personalized action items, and earn performance badges.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Executive AI Synthesis</span>
                    <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
                      {progressData.coaching_summary}
                    </p>
                  </div>

                  {progressData.action_items && progressData.action_items.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Targeted Action Items</span>
                      <div className="space-y-2">
                        {progressData.action_items.map((act: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-200 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Milestones Column */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Earned Milestones</span>
                  <div className="space-y-2.5">
                    {(progressData.milestones || []).length === 0 ? (
                      <div className="p-3 text-center rounded-xl bg-white/5 border border-white/5 text-xs text-slate-400">
                        No achievement milestones recorded yet.
                      </div>
                    ) : (
                      (progressData.milestones || []).map((m: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                          <span className="text-2xl">{m.badge}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{m.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{m.description}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        {metrics.recent_activity && metrics.recent_activity.length > 0 && (
          <div className="card-luxury p-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            <h3 className="text-xs font-extrabold text-brand-ink dark:text-white uppercase tracking-wider">Recent Activity</h3>
            <div className="space-y-3">
              {metrics.recent_activity.map((act: any, i: number) => (
                <div key={act.id || i} className="flex items-start gap-3 p-3 rounded-xl bg-cream-100 dark:bg-slate-800/60 border border-stoneBorder dark:border-slate-700/60 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-ink dark:text-white">{act.title}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium mt-0.5 truncate">{act.message}</p>
                  </div>
                  {act.created_at && (
                    <span className="text-[9px] font-bold text-slate-400 shrink-0">
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
