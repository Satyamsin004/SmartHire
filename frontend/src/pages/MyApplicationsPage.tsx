import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CheckCircle2, Clock, ChevronRight, Sparkles, Building2, Calendar, Award,
  Briefcase, MapPin, UserCheck, Paperclip, ExternalLink, Download, Check, X, AlertCircle,
  Video, BookOpen, Star, DollarSign
} from 'lucide-react';
import api from '../services/api';

export const MyApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // NOTE: Strictly fetching ONLY real recruiter hiring data. Mock Practice Hub endpoints (/aptitude/history & /interview/history) are PURGED.
      const [appRes, offerRes, userRes] = await Promise.allSettled([
        api.get('/jobs/my-applications'),
        api.get('/offers/my-offers'),
        api.get('/users/me')
      ]);

      if (appRes.status === 'fulfilled') setMyApplications(appRes.value?.data || []);
      if (offerRes.status === 'fulfilled') setOffers(offerRes.value?.data || []);
      if (userRes.status === 'fulfilled') setUserProfile(userRes.value?.data || null);
    } catch (err) {
      console.warn('Fetch applications page data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferResponse = async (offerId: string, action: 'accept' | 'decline') => {
    setRespondingOfferId(offerId);
    try {
      await api.post(`/offers/${offerId}/respond`, { action });
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to update offer response.');
    } finally {
      setRespondingOfferId(null);
    }
  };

  const PIPELINE_STAGES = [
    { label: '1. Applied', key: 'applied' },
    { label: '2. ATS Passed', key: 'ats' },
    { label: '3. Online Assessment', key: 'assessment' },
    { label: '4. Technical Interview', key: 'tech' },
    { label: '5. Behavioral Interview', key: 'behavioral' },
    { label: '6. HR Interview', key: 'hr' },
    { label: '7. Offer Letter', key: 'offer' },
    { label: '8. Candidate Decision', key: 'decision' },
  ];

  const getStageStatus = (app: any, stageIdx: number) => {
    const status = (app.status || '').toLowerCase();
    const atsScore = app.ats_score !== null && app.ats_score !== undefined ? app.ats_score : 85;
    const isAtsPassed = atsScore >= 80;
    const recAssess = app.recruiter_assessment;
    const recInt = app.recruiter_interview;
    const offer = app.offer_details;

    // Stage 1: Applied (Automatically completed immediately upon applying)
    if (stageIdx === 0) {
      return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
    }

    // Stage 2: ATS Passed (Auto: Green if ATS >= 80, Red if ATS < 80 and stops pipeline)
    if (stageIdx === 1) {
      if (!isAtsPassed) {
        return { text: 'Rejected (ATS < 80%)', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Completed (ATS Passed)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
    }

    // If ATS Failed, all subsequent pipeline stages are stopped/disabled
    if (!isAtsPassed) {
      return { text: 'Pipeline Stopped', color: 'bg-slate-100 text-slate-300 border-slate-200', isUpcoming: true };
    }

    // Stage 3: Online Assessment (Controlled ONLY by recruiter assessment)
    if (stageIdx === 2) {
      if (!recAssess) {
        return { text: 'Not Scheduled', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
      }
      if (recAssess.status === 'Completed') {
        return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (recAssess.status === 'Failed') {
        return { text: 'Failed', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
    }

    // Stage 4: Technical Interview (Controlled ONLY by recruiter interview)
    if (stageIdx === 3) {
      if (!recInt) {
        return { text: 'Not Scheduled', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
      }
      if (recInt.status === 'Completed') {
        return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (recInt.status === 'Failed') {
        return { text: 'Failed', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
    }

    // Stage 5: Behavioral Interview (Recruiter Controlled)
    if (stageIdx === 4) {
      if (status.includes('behavioral') && (status.includes('completed') || status.includes('passed'))) {
        return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('behavioral')) {
        return { text: 'Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    // Stage 6: HR Interview (Recruiter Controlled)
    if (stageIdx === 5) {
      if (status.includes('hr') && (status.includes('completed') || status.includes('passed'))) {
        return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (status.includes('hr')) {
        return { text: 'Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    // Stage 7: Offer Letter (Recruiter Controlled)
    if (stageIdx === 6) {
      if (!offer) {
        return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
      }
      if (offer.status === 'Accepted' || offer.status === 'Completed') {
        return { text: 'Offer Accepted', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (offer.status === 'Rejected' || offer.status === 'Declined') {
        return { text: 'Offer Declined', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Offer Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    // Stage 8: Candidate Decision
    if (stageIdx === 7) {
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Accepted', color: 'bg-emerald-600 text-white border-emerald-600', isDone: true };
      }
      if (offer?.status === 'Rejected' || status.includes('declined') || status.includes('rejected')) {
        return { text: 'Rejected', color: 'bg-rose-600 text-white border-rose-600', isFailed: true };
      }
      return { text: 'Pending', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
    }

    return { text: 'Upcoming', color: 'bg-slate-100 text-slate-400 border-slate-200', isUpcoming: true };
  };

  return (
    <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Candidate Applications Hub
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">My Applications</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time recruiter hiring workflow for every application. Mock Practice Hub data is strictly isolated.
          </p>
        </div>

        <button
          onClick={() => navigate('/jobs')}
          className="px-6 py-3 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Briefcase className="w-4 h-4" />
          <span>Browse Open Jobs</span>
        </button>
      </div>

      {/* Applications List */}
      <div className="space-y-8">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-extrabold text-slate-500">Loading your recruiter hiring workflows...</p>
          </div>
        ) : myApplications.length === 0 ? (
          /* EMPTY STATE */
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">You haven't applied to any jobs yet.</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed font-medium">
                Explore open requisitions in our jobs catalog and submit your application to track real-time recruitment progress.
              </p>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="px-6 py-3 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs inline-flex items-center gap-2 shadow-md transition-all"
            >
              <Briefcase className="w-4 h-4" />
              <span>Browse Jobs</span>
            </button>
          </div>
        ) : (
          myApplications.map((app) => {
            const offer = app.offer_details || offers.find((o) => o.job_application_id === app.id);
            const recAssess = app.recruiter_assessment;
            const recInt = app.recruiter_interview;
            const atsScore = app.ats_score !== null && app.ats_score !== undefined ? app.ats_score : 85;
            const isAtsPassed = atsScore >= 80;
            const statusLower = (app.status || '').toLowerCase();
            const isRejected = statusLower.includes('reject') || !isAtsPassed;

            return (
              <div key={app.id} className="bg-white rounded-3xl border border-slate-200/90 p-6 lg:p-8 space-y-6 shadow-xs transition-all hover:border-indigo-200">
                {/* 1. APPLICATION HEADER DETAILS */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl shrink-0">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-slate-900">{app.job_title || 'Software Position'}</h2>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {app.work_mode || 'Remote'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 flex items-center gap-3">
                        <span className="text-indigo-600">{app.company_name || 'SmartHire Corporate'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-400 font-medium">
                          <MapPin className="w-3.5 h-3.5" /> {app.location || 'Remote'}
                        </span>
                      </p>
                      <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-500 font-semibold flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> Applied Date: {app.applied_at ? new Date(app.applied_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Recruiter: {app.recruiter_contact || 'Hiring Manager'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border ${
                      isAtsPassed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <Award className="w-4 h-4 text-indigo-500" />
                      <span>ATS Score: {atsScore}% ({isAtsPassed ? 'Passed' : 'Rejected'})</span>
                    </div>

                    <div className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border ${
                      isRejected ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      statusLower.includes('hired') || statusLower.includes('accepted') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      statusLower.includes('offer') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      Current Status: {app.status || 'Applied'}
                    </div>
                  </div>
                </div>

                {/* Submitted Resume & Attachments */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-500" />
                    <span>Submitted Resume: <strong className="text-slate-900 font-extrabold">{userProfile?.resume_url ? 'Candidate_Resume.pdf' : 'Application_Resume.pdf'}</strong></span>
                  </div>
                  {userProfile?.resume_url && (
                    <a
                      href={userProfile.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Submitted Resume</span>
                    </a>
                  )}
                </div>

                {/* 2. RECRUITER RECRUITMENT PIPELINE STAGES */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Independent Recruitment Pipeline</h4>
                    <span className="text-[11px] font-bold text-slate-400">8 Recruiter Stages</span>
                  </div>

                  <div className="overflow-x-auto pb-3 pt-1">
                    <div className="flex items-center gap-2 min-w-[980px]">
                      {PIPELINE_STAGES.map((stage, idx) => {
                        const { text, color, isDone, isCurrent, isFailed } = getStageStatus(app, idx);

                        return (
                          <React.Fragment key={stage.key}>
                            <div className={`px-3.5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap border ${color}`}>
                              <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                {isDone ? <CheckCircle2 className="w-4 h-4" /> :
                                 isFailed ? <X className="w-4 h-4" /> :
                                 isCurrent ? <Clock className="w-4 h-4 animate-spin" /> :
                                 <span className="text-[10px] font-bold opacity-60">{idx + 1}</span>}
                              </div>
                              <span>{stage.label}</span>
                            </div>
                            {idx < PIPELINE_STAGES.length - 1 && (
                              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. RECRUITER STAGE DETAILS (ONLINE ASSESSMENT, TECHNICAL INTERVIEW, OFFER LETTER) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  
                  {/* ONLINE ASSESSMENT (RECRUITER CONTROLLED ONLY) */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-500" /> Online Assessment
                      </h5>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">Stage 3</span>
                    </div>

                    {recAssess ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-600 font-medium">
                          <span>Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${recAssess.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                            {recAssess.status}
                          </span>
                        </div>
                        {recAssess.score !== null && recAssess.score !== undefined && (
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Assessment Score:</span>
                            <strong className="text-emerald-600 font-extrabold text-sm">{recAssess.score}%</strong>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-slate-600 font-medium">
                          <span>Date / Duration:</span>
                          <span className="font-bold text-slate-800">{recAssess.attempt_date} ({recAssess.duration_minutes} Mins)</span>
                        </div>

                        {recAssess.status === 'Completed' ? (
                          <button
                            onClick={() => navigate(`/assessment/exam?session=${recAssess.session_id}`)}
                            className="w-full mt-2 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-extrabold transition-colors shadow-2xs"
                          >
                            View Assessment Report
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/assessment/exam?session=${recAssess.session_id}`)}
                            className="w-full mt-2 py-2 rounded-xl bg-brand-primary hover:bg-sb-700 text-white text-xs font-extrabold transition-colors shadow-2xs"
                          >
                            Start Assessment Now
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 py-2">
                        <p className="text-xs font-extrabold text-slate-500">Not Scheduled</p>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                          No assessment scheduled by recruiter yet. No score available.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* TECHNICAL INTERVIEW (RECRUITER CONTROLLED ONLY) */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-purple-500" /> Technical Interview
                      </h5>
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">Stage 4</span>
                    </div>

                    {recInt ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-600 font-medium">
                          <span>Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${recInt.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                            {recInt.status}
                          </span>
                        </div>
                        {recInt.scheduled_date && (
                          <div className="text-[11px] text-slate-600 font-medium">
                            Scheduled: <strong className="text-slate-900">{recInt.scheduled_date}</strong>
                          </div>
                        )}
                        {recInt.technical_score !== null && recInt.technical_score !== undefined && (
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 font-medium pt-1">
                            <div>Technical: <strong className="text-slate-900">{recInt.technical_score}%</strong></div>
                            <div>Comm: <strong className="text-slate-900">{recInt.communication_score}%</strong></div>
                            <div>Confidence: <strong className="text-slate-900">{recInt.confidence_score}%</strong></div>
                            <div>Prof: <strong className="text-slate-900">{recInt.professionalism_score}%</strong></div>
                          </div>
                        )}

                        {recInt.status === 'Completed' ? (
                          <button
                            onClick={() => navigate(`/report?id=${recInt.session_id}`)}
                            className="w-full mt-2 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-extrabold transition-colors shadow-2xs"
                          >
                            View Interview Report
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/interview/lobby?schedule=${recInt.schedule_id}`)}
                            className="w-full mt-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold transition-colors shadow-2xs"
                          >
                            Join Scheduled Interview
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 py-2">
                        <p className="text-xs font-extrabold text-slate-500">Not Scheduled</p>
                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                          No interview scheduled by recruiter yet. No score available.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* OFFICIAL OFFER LETTER (RECRUITER CONTROLLED ONLY) */}
                  <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-amber-600" /> Offer Status
                      </h5>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">Stage 7</span>
                    </div>

                    {offer ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-700 font-medium">
                          <span>Salary:</span>
                          <strong className="text-amber-700 font-extrabold text-sm">{offer.salary_offered || '$135,000 / yr'}</strong>
                        </div>
                        <div className="flex justify-between items-center text-slate-700 font-medium">
                          <span>Joining Date:</span>
                          <span className="font-bold text-slate-900">{offer.start_date || 'ASAP'}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700 font-medium">
                          <span>Location:</span>
                          <span className="font-bold text-slate-900">{app.location || 'Remote'}</span>
                        </div>

                        {offer.status === 'Accepted' ? (
                          <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black text-center mt-2">
                            🎉 Offer Accepted! Welcome aboard!
                          </div>
                        ) : offer.status === 'Rejected' ? (
                          <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-black text-center mt-2">
                            Offer Declined by Candidate
                          </div>
                        ) : (
                          <div className="space-y-2 pt-1">
                            <button
                              onClick={() => alert(`Official Offer Letter:\n\n${offer.offer_letter_text || 'Congratulations! You are officially offered the position.'}`)}
                              className="w-full py-1.5 rounded-xl bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 text-xs font-extrabold flex items-center justify-center gap-1 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Offer Letter
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleOfferResponse(offer.id, 'accept')}
                                disabled={respondingOfferId === offer.id}
                                className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" /> Accept
                              </button>
                              <button
                                onClick={() => handleOfferResponse(offer.id, 'decline')}
                                disabled={respondingOfferId === offer.id}
                                className="py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 py-2">
                        <p className="text-xs font-extrabold text-amber-700 font-extrabold">Not Released</p>
                        <p className="text-[11px] text-amber-600/80 font-medium leading-relaxed">
                          Official offer letter will appear here once recruiter completes all evaluation rounds.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
};
