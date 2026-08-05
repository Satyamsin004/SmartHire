import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Plus, Layers, Clock, ShieldCheck, Award, Users, Filter, ArrowRight, Sparkles, Building2
} from 'lucide-react';
import api from '../../services/api';

export const RecruiterAssessmentsPage: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('');

  // Config Form
  const [title, setTitle] = useState<string>('Technical & Aptitude Online Assessment');
  const [topicsStr, setTopicsStr] = useState<string>('DBMS, Operating Systems, Computer Networks, React, PostgreSQL');
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [qCount, setQCount] = useState<number>(10);
  const [duration, setDuration] = useState<number>(15);
  const [passingScore, setPassingScore] = useState<number>(70);
  const [negativeMarking, setNegativeMarking] = useState<number>(0.25);
  const [proctoring, setProctoring] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    api.get('/recruiter/posted-jobs')
      .then((res) => {
        setJobs(res.data || []);
        if (res.data && res.data.length > 0) setSelectedJob(res.data[0].id);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleCreateAssessmentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    const topicsArray = topicsStr.split(',').map(t => t.trim()).filter(Boolean);

    try {
      await api.post('/aptitude/start', {
        title: title,
        topics: topicsArray,
        difficulty: difficulty,
        question_count: qCount,
        duration_minutes: duration,
        passing_score: passingScore,
        negative_marking: negativeMarking,
        proctoring_enabled: proctoring,
        is_recruiter_configured: true,
        job_id: selectedJob
      });
      alert('Recruiter Online Assessment configured successfully using Unified AI Engine!');
    } catch (err) {
      console.error(err);
      alert('Failed to configure assessment.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Online Assessment Manager</h1>
            <p className="text-xs font-semibold text-slate-500">Configure proctored technical & aptitude screening tests for candidate requisitions</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-xs">
          <h2 className="text-lg font-extrabold text-slate-900">Configure Requisition Assessment</h2>

          <form onSubmit={handleCreateAssessmentConfig} className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Target Job Requisition</label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title} ({j.company_name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Assessment Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Evaluation Topics (Comma Separated)</label>
              <input
                type="text"
                value={topicsStr}
                onChange={(e) => setTopicsStr(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                  <option>Expert</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Passing Threshold (%)</label>
                <input
                  type="number"
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseFloat(e.target.value) || 70)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Question Count</label>
                <input
                  type="number"
                  value={qCount}
                  onChange={(e) => setQCount(parseInt(e.target.value) || 10)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">Time Limit (Mins)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              <span>{creating ? 'Configuring Assessment...' : 'Publish Recruiter Assessment'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-8 text-white space-y-6 border border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight">Unified Engine Advantages</h3>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Recruiter online tests reuse the identical AI Assessment Engine as candidate mock practice, guaranteeing consistent evaluation criteria and PostgreSQL persistence.
          </p>
        </div>
      </div>
    </main>
  );
};
