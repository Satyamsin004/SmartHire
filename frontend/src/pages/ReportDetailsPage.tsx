import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { ReportsAnalyticsIllustration } from '../components/illustrations/Illustrations';
import { Award, CheckCircle2, AlertCircle, Download, Sparkles, Video } from 'lucide-react';
import api from '../services/api';

export const ReportDetailsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      api.get(`/interview/report/${sessionId}`)
        .then((res) => setReport(res.data))
        .catch((err) => console.warn('Fetch report error:', err))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-ink">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Hero Header */}
          <div className="bg-gradient-to-r from-brand-primary via-sb-800 to-brand-ink rounded-5xl p-8 lg:p-12 text-white relative overflow-hidden shadow-floating">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                  <Award className="w-4 h-4" />
                  <span>Deterministic Telemetry Audit</span>
                </div>
                <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white">
                  AI Candidate Evaluation Report
                </h1>
                <p className="text-sm text-slate-300 font-medium max-w-lg">
                  Deterministic metrics computed via weighted scoring formula across technical mastery, speech fluency, eye tracking, and dynamic problem solving.
                </p>
              </div>

              <div className="lg:col-span-5 hidden lg:block">
                <ReportsAnalyticsIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-24 text-center card-luxury">
              <Sparkles className="w-10 h-10 text-brand-secondary animate-spin mx-auto mb-4" />
              <p className="text-sm font-extrabold text-brand-ink">Computing Final Multimodal Metrics...</p>
            </div>
          ) : !report ? (
            <div className="py-16 text-center card-luxury">
              <p className="text-xs font-extrabold text-slate-500">No session report selected.</p>
              <p className="text-[11px] text-slate-400 mt-1">Select an interview session from candidate or recruiter dashboard.</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Score Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                <div className="card-luxury p-6 text-center bg-brand-primary text-white">
                  <p className="text-xs font-extrabold text-brand-accent uppercase tracking-wider">Overall Score</p>
                  <h2 className="text-4xl font-extrabold text-white mt-2">{report.overall_score}%</h2>
                  <p className="text-[11px] text-slate-200 mt-1">{report.rating_rubric}</p>
                </div>

                <div className="card-luxury p-6 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Technical Score</p>
                  <h2 className="text-3xl font-extrabold text-brand-ink mt-2">{report.technical_score}%</h2>
                </div>

                <div className="card-luxury p-6 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Communication</p>
                  <h2 className="text-3xl font-extrabold text-brand-ink mt-2">{report.communication_score}%</h2>
                </div>

                <div className="card-luxury p-6 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confidence</p>
                  <h2 className="text-3xl font-extrabold text-brand-ink mt-2">{report.confidence_score}%</h2>
                </div>

              </div>

              {/* Strengths & Growth Plan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <div className="card-luxury p-8 space-y-4 border-l-8 border-brand-primary">
                  <h4 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand-primary" /> Key Demonstrated Strengths
                  </h4>
                  <ul className="space-y-2 text-xs font-semibold text-slate-600">
                    {report.strengths?.map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                        {s}
                      </li>
                    )) || <li>Strong technical explanation and API architecture understanding.</li>}
                  </ul>
                </div>

                <div className="card-luxury p-8 space-y-4 border-l-8 border-amber-500">
                  <h4 className="text-sm font-extrabold text-brand-ink uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" /> AI Upskilling Recommendations
                  </h4>
                  <ul className="space-y-2 text-xs font-semibold text-slate-600">
                    {report.improvement_plan?.map((p: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {p}
                      </li>
                    )) || <li>Practice PostgreSQL indexing strategies and query execution plan optimization.</li>}
                  </ul>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
};
