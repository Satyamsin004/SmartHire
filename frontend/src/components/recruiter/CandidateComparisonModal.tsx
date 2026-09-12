import React, { useState, useEffect } from 'react';
import {
  X, Trophy, Shield, Brain, MessageSquare, Award, Target, CheckCircle2,
  AlertTriangle, ArrowRight, UserCheck, Eye, ExternalLink, Sparkles, Sliders,
  TrendingUp, Check, Gift, Video
} from 'lucide-react';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import api from '../../services/api';

interface CandidateComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateIds: string[];
  jobId?: string;
  onShortlist?: (candidateId: string) => void;
  onSchedule?: (candidate: any) => void;
  onOffer?: (candidate: any) => void;
  onViewProfile?: (candidateId: string) => void;
  onViewReport?: (sessionId: string) => void;
}

const CANDIDATE_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#8B5CF6'];

export const CandidateComparisonModal: React.FC<CandidateComparisonModalProps> = ({
  isOpen,
  onClose,
  candidateIds,
  jobId,
  onShortlist,
  onSchedule,
  onOffer,
  onViewProfile,
  onViewReport
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [chartType, setChartType] = useState<'radar' | 'bar'>('radar');

  useEffect(() => {
    if (isOpen && candidateIds.length >= 2) {
      fetchComparison();
    }
  }, [isOpen, candidateIds, jobId]);

  const fetchComparison = async () => {
    try {
      setLoading(true);
      const res = await api.post('/analytics/recruiter/candidate-comparison', {
        candidate_ids: candidateIds,
        job_id: jobId && jobId !== 'all' ? jobId : undefined
      });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching candidate comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const candidates = data?.candidates || [];
  const radarMetrics = data?.radar_metrics || [];
  const verdict = data?.verdict;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 lg:p-6 animate-fade-in">
      <div className="relative w-full max-w-6xl bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 lg:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-transparent dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-transparent shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-xs flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                CANDIDATE INTELLIGENCE COMPARISON
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Comparing {candidateIds.length} Candidates
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Side-by-Side Competency Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Deterministic evaluation scorecard comparison across technical, communication, confidence, and professionalism benchmarks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setChartType('radar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  chartType === 'radar' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                Radar Chart
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  chartType === 'bar' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                Bar Chart
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Synthesizing candidate competency matrices...</p>
            </div>
          ) : candidates.length < 2 ? (
            <div className="p-12 text-center text-slate-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Insufficient Candidates for Comparison</h4>
              <p className="text-xs text-slate-500 mt-1">Please select at least 2 candidates to generate side-by-side comparative analytics.</p>
            </div>
          ) : (
            <>
              {/* AI Comparative Verdict Banner */}
              {verdict && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/30 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      AI COMPARATIVE VERDICT & HIRING RECOMMENDATION
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                      {verdict}
                    </p>
                  </div>
                </div>
              )}

              {/* Top Candidate Cards Strip */}
              <div className={`grid grid-cols-1 md:grid-cols-${Math.min(candidates.length, 4)} gap-4`}>
                {candidates.map((cand: any, idx: number) => {
                  const color = CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length];
                  const isLeader = (cand.application_id && data?.top_pick_candidate_id === cand.application_id) ||
                                   (!cand.application_id && data?.top_pick_candidate_id === cand.candidate_id);

                  return (
                    <div
                      key={cand.application_id || cand.candidate_id || idx}
                      className={`relative overflow-hidden p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                        isLeader
                          ? 'bg-gradient-to-b from-indigo-500/10 to-transparent border-indigo-500/50 shadow-lg'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      {isLeader && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                          <Trophy className="w-3 h-3" />
                          Top Pick
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-md shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {cand.name ? cand.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {cand.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{cand.email}</p>
                          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 block mt-0.5 truncate">
                            {cand.target_role}
                          </span>
                        </div>
                      </div>

                      {/* Score Strip */}
                      <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                        <div>
                          <p className="text-[9px] font-bold uppercase text-slate-400">Overall Score</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{cand.overall_score}%</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase text-slate-400">ATS Match</p>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{cand.ats_score}%</p>
                        </div>
                      </div>

                      {/* Recommendation Badge */}
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Verdict:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          cand.recommendation.includes('Strong')
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300'
                            : cand.recommendation.includes('Hire')
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300'
                        }`}>
                          {cand.recommendation}
                        </span>
                      </div>

                      {/* Candidate Quick Actions */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                        {onViewProfile && (
                          <button
                            onClick={() => onViewProfile(cand.candidate_id)}
                            className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Profile
                          </button>
                        )}
                        {cand.session_id && onViewReport && (
                          <button
                            onClick={() => onViewReport(cand.session_id)}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Award className="w-3 h-3" /> Report
                          </button>
                        )}
                        {onShortlist && (
                          <button
                            onClick={() => onShortlist(cand.candidate_id)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                            title="Shortlist Candidate"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visual Competency Graph (Radar or Bar) */}
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Cross-Competency Overlay Chart
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Normalized competency scores across technical, communication, confidence, and professionalism.
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full">
                  {chartType === 'radar' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarMetrics}>
                        <PolarGrid stroke="#94a3b833" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                        {candidates.map((c: any, i: number) => (
                          <Radar
                            key={c.application_id || c.candidate_id || i}
                            name={c.name}
                            dataKey={`candidate_${i + 1}`}
                            stroke={CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]}
                            fill={CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]}
                            fillOpacity={0.25}
                          />
                        ))}
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '11px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={radarMetrics} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b822" />
                        <XAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                        {candidates.map((c: any, i: number) => (
                          <Bar
                            key={c.application_id || c.candidate_id || i}
                            dataKey={`candidate_${i + 1}`}
                            name={c.name}
                            fill={CANDIDATE_COLORS[i % CANDIDATE_COLORS.length]}
                            radius={[6, 6, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Side-by-Side Detailed Evaluation Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase font-black text-[10px]">
                      <th className="py-3 px-4">Evaluation Dimension</th>
                      {candidates.map((c: any, idx: number) => (
                        <th key={c.application_id || c.candidate_id || idx} className="py-3 px-4 font-black">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length] }} />
                            {c.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Overall Score</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4 font-black text-sm text-indigo-600 dark:text-indigo-400">
                          {c.overall_score}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Technical Core (30%)</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4 font-bold">
                          {c.technical_score}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Verbal Communication (30%)</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4 font-bold">
                          {c.communication_score}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Confidence & Poise (25%)</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4 font-bold">
                          {c.confidence_score}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Professionalism (15%)</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4 font-bold">
                          {c.professionalism_score}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">ATS Resume Match</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          {c.ats_score}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Key Strengths</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4">
                          <div className="space-y-1">
                            {c.strengths.map((s: string, si: number) => (
                              <span key={si} className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 mr-1 mb-1 border border-emerald-200 dark:border-emerald-800">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 font-bold">Growth Areas / Concerns</td>
                      {candidates.map((c: any) => (
                        <td key={c.candidate_id} className="py-3 px-4">
                          <div className="space-y-1">
                            {c.concerns.map((con: string, ci: number) => (
                              <span key={ci} className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 mr-1 mb-1 border border-rose-200 dark:border-rose-800">
                                {con}
                              </span>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 lg:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400 font-medium">
            Computed deterministically from PostgreSQL evaluation reports.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-xs transition-colors cursor-pointer"
          >
            Close Comparison
          </button>
        </div>

      </div>
    </div>
  );
};
