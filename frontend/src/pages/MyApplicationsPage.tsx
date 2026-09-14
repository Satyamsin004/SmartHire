import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CheckCircle2, Clock, ChevronRight, Sparkles, Building2, Calendar, Award,
  Briefcase, MapPin, UserCheck, Paperclip, ExternalLink, Download, Check, X, AlertCircle,
  Video, BookOpen, Star, DollarSign, Lock, Brain, Users, Eye
} from 'lucide-react';
import api, { resolveResumeUrl } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

export const MyApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { lastMessage } = useWebSocket();
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);

  const isRoundPendingSchedule = (round: any) => {
    if (!round) return false;
    if (round.can_start === false) return true;
    const isoStr = round.scheduled_date_iso || round.scheduled_date;
    if (!isoStr) return false;
    const ms = new Date(isoStr).getTime();
    return !isNaN(ms) && Date.now() < ms;
  };

  useEffect(() => {
    fetchData(false);

    // Auto-update both pipelines in real-time silently without flickering
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);

    const handleWindowFocus = () => {
      fetchData(true);
    };

    const handlePipelineEvent = () => {
      fetchData(true);
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('visibilitychange', handleWindowFocus);
    window.addEventListener('APPLICATION_PIPELINE_UPDATED', handlePipelineEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleWindowFocus);
      window.removeEventListener('APPLICATION_PIPELINE_UPDATED', handlePipelineEvent);
    };
  }, []);

  // Real-time synchronization whenever WebSocket event is received
  useEffect(() => {
    if (lastMessage) {
      fetchData(true);
    }
  }, [lastMessage]);

  const fetchData = async (isBackground: boolean = false) => {
    if (!isBackground && myApplications.length === 0) {
      setLoading(true);
    }
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
    const atsScore = app.ats_score !== null && app.ats_score !== undefined ? app.ats_score : (app.match_score ?? null);
    const isAtsPassed = atsScore !== null ? atsScore >= 80 : (status.includes('shortlist') || status.includes('screen') || status.includes('interview') || status.includes('assessment') || status.includes('offer') || status.includes('hired'));
    const recAssess = app.recruiter_assessment;
    const offer = app.offer_details || offers.find((o) => o.job_application_id === app.id);
    const hasOffer = Boolean(offer) || status.includes('offer') || status.includes('hired') || status.includes('accepted');
    const isOfferAccepted = offer?.status === 'Accepted' || status.includes('hired') || status.includes('accepted');

    const assessScore = app.assessment_score ?? recAssess?.score ?? null;
    const isAssessmentConducted = (assessScore !== null && assessScore !== undefined) || (recAssess && recAssess.score !== null && recAssess.score !== undefined);

    // If candidate has an issued or accepted offer, all qualifying prior stages are definitively completed
    if (hasOffer) {
      if (stageIdx === 0) return { text: 'Completed', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 1) return { text: 'Completed (ATS Passed)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 2) {
        if (isAssessmentConducted) return { text: 'Completed (Passed)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
        return { text: 'Waived (Direct Offer)', color: 'bg-slate-700 text-slate-300 border-slate-600', isWaived: true };
      }
      if (stageIdx === 3) return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 4) return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 5) return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      if (stageIdx === 6) {
        if (isOfferAccepted) return { text: 'Offer Accepted', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
        return { text: 'Offer Released', color: 'bg-emerald-600 text-white border-emerald-600 animate-pulse', isCurrent: true };
      }
      if (stageIdx === 7) {
        if (isOfferAccepted) return { text: 'Hired', color: 'bg-emerald-600 text-white border-emerald-600', isDone: true };
        return { text: 'Pending Decision', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
    }

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
      return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    const passThreshold = recAssess?.passing_score ?? 70;
    const hasAssessmentSession = Boolean(recAssess?.session_id || app.assessment_session_id);
    const isExplicitlyPassed = isAssessmentConducted && (
      (assessScore !== null && assessScore >= passThreshold) ||
      (recAssess && recAssess.score !== null && recAssess.score >= passThreshold) ||
      status.includes('assessment pass')
    );
    const isExplicitlyFailed = isAssessmentConducted && (
      (assessScore !== null && assessScore < passThreshold) ||
      (recAssess && recAssess.score !== null && recAssess.score < passThreshold) ||
      status.includes('assessment fail')
    );

    const isAssessmentPassed = isExplicitlyPassed;
    const isAssessmentFailed = isExplicitlyFailed;
    // Stage 3: Online Assessment
    if (stageIdx === 2) {
      if (isAssessmentFailed) {
        return { text: `Failed (<${passThreshold}%)`, color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isAssessmentPassed) {
        return { text: `Passed (≥${passThreshold}%)`, color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (recAssess?.status === 'active' || recAssess?.status === 'in_progress') {
        return { text: 'Assessment In Progress', color: 'bg-indigo-600 text-white border-indigo-600 animate-pulse', isCurrent: true };
      }
      if (status.includes('assessment scheduled') || recAssess?.status === 'Scheduled') {
        return { text: 'Assessment Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Not Scheduled', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    if (!isAssessmentPassed) {
      if (isAssessmentFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (Assessment Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }    
    
    const techRound = app.technical_round;
    const techScore = techRound?.technical_score ?? techRound?.overall_score ?? (app.technical_score ?? app.overall_score ?? null);
    const isTechFailed = status.includes('interview failed') || status.includes('tech failed') || status.includes('reject');
    const isTechPassed = !isTechFailed && (
      status.includes('tech passed') || status.includes('technical passed') || status.includes('round 2') ||
      status.includes('behavioral') || status.includes('hr') || status.includes('selected') ||
      status.includes('offer') || status.includes('hired') || status.includes('interview passed')
    );
    const isTechConducted = Boolean(techRound?.is_conducted || (techRound?.status === 'Completed') || techScore != null);

    // Stage 4: Technical Interview (Manual Recruiter Pass/Reject Decision)
    if (stageIdx === 3) {
      if (isTechFailed) {
        return { text: 'Rejected', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isTechPassed) {
        return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (isTechConducted) {
        return { text: 'Under Recruiter Review', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
      if (status.includes('interview scheduled') || techRound?.status === 'Scheduled') {
        return { text: 'Tech Scheduled', color: 'bg-purple-600 text-white border-purple-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Tech Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isTechPassed) {
      if (isTechFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (Tech Pass Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    const behavRound = app.behavioral_round;
    const behavScore = behavRound?.overall_score ?? (app.communication_score ?? null);
    const isBehavFailed = status.includes('behavioral failed') || status.includes('interview failed') || status.includes('reject');
    const isBehavPassed = !isBehavFailed && (
      status.includes('behavioral passed') || status.includes('move to hr') || status.includes('hr') ||
      status.includes('selected') || status.includes('offer') || status.includes('hired')
    );
    const isBehavConducted = Boolean(behavRound?.is_conducted || (behavRound?.status === 'Completed') || behavScore != null);

    // Stage 5: Behavioral Interview (Manual Recruiter Pass/Reject Decision)
    if (stageIdx === 4) {
      if (isBehavFailed) {
        return { text: 'Rejected', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isBehavPassed) {
        return { text: 'Passed (Qualified)', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (isBehavConducted) {
        return { text: 'Under Recruiter Review', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
      if (status.includes('behavioral') || behavRound?.status === 'Scheduled') {
        return { text: 'Behavioral Scheduled', color: 'bg-blue-600 text-white border-blue-600 animate-pulse', isCurrent: true };
      }
      return { text: 'Behavioral Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isBehavPassed) {
      if (isBehavFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (Behavioral Pass Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    const hrRound = app.hr_round;
    const hrScore = hrRound?.overall_score ?? (app.professionalism_score ?? null);
    const isHrFailed = status.includes('hr failed') || status.includes('interview failed') || status.includes('reject');
    const isHrPassed = !isHrFailed && (
      status.includes('hr passed') || status.includes('hr completed') || status.includes('selected') ||
      status.includes('offer') || status.includes('hired')
    );
    const isHrConducted = Boolean(hrRound?.is_conducted || (hrRound?.status === 'Completed') || hrScore != null);

    // Stage 6: HR Interview (Manual Recruiter Pass/Reject Decision)
    if (stageIdx === 5) {
      if (isHrFailed) {
        return { text: 'Rejected', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      if (isHrPassed) {
        return { text: 'Passed (Qualified)', color: 'bg-teal-600 text-white border-teal-600 animate-pulse', isDone: true };
      }
      if (isHrConducted) {
        return { text: 'Under Recruiter Review', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
      if (status.includes('hr') || hrRound?.status === 'Scheduled') {
        return { text: 'HR Scheduled', color: 'bg-teal-600 text-white border-teal-600 animate-pulse', isCurrent: true };
      }
      return { text: 'HR Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
    }

    if (!isHrPassed) {
      if (isHrFailed) {
        return { text: 'Pipeline Stopped', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
      }
      return { text: 'Upcoming (HR Pass Required)', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    // Stage 7: Offer Letter
    if (stageIdx === 6) {
      if (!offer && !status.includes('offer')) {
        return { text: 'Decision Pending', color: 'bg-amber-500 text-white border-amber-500 animate-pulse', isCurrent: true };
      }
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Offer Accepted', color: 'bg-emerald-500 text-white border-emerald-500', isDone: true };
      }
      if (offer?.status === 'Rejected' || offer?.status === 'Declined' || status.includes('declined')) {
        return { text: 'Offer Declined', color: 'bg-rose-500 text-white border-rose-500', isFailed: true };
      }
      return { text: 'Offer Released', color: 'bg-emerald-600 text-white border-emerald-600 animate-pulse', isCurrent: true };
    }

    // Stage 8: Candidate Decision
    if (stageIdx === 7) {
      if (offer?.status === 'Accepted' || status.includes('accepted') || status.includes('hired')) {
        return { text: 'Hired', color: 'bg-emerald-600 text-white border-emerald-600', isDone: true };
      }
      return { text: 'Pending Decision', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
    }

    return { text: 'Upcoming', color: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700', isUpcoming: true };
  };

  return (
    <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-300">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-black mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Candidate Applications Hub
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Applications</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Real-time recruiter hiring workflow for every application. Mock Practice Hub data is strictly isolated.
          </p>
        </div>

        <button
          onClick={() => navigate('/jobs')}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Briefcase className="w-4 h-4" />
          <span>Browse Open Jobs</span>
        </button>
      </div>

      {/* Applications List */}
      <div className="space-y-8">
        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">Loading your recruiter hiring workflows...</p>
          </div>
        ) : myApplications.length === 0 ? (
          /* EMPTY STATE */
          <div className="p-12 text-center bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">You haven't applied to any jobs yet.</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed font-medium">
                Explore open requisitions in our jobs catalog and submit your application to track real-time recruitment progress.
              </p>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
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
              <div key={app.id} className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 lg:p-8 space-y-6 shadow-xs transition-all hover:border-indigo-200 dark:hover:border-slate-700">
                {/* 1. APPLICATION HEADER DETAILS */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl shrink-0">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">{app.job_title || 'Software Position'}</h2>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                          {app.work_mode || 'Remote'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-3">
                        <span className="text-indigo-600 dark:text-indigo-400">
                          {(() => {
                            const cName = app.company_name;
                            if (cName && !cName.toLowerCase().includes('smarthire') && !cName.toLowerCase().includes('smart-hire')) {
                              return cName;
                            }
                            const title = (app.job_title || '').toLowerCase();
                            if (title.includes('support')) return 'Zomato';
                            if (title.includes('sde') || title.includes('intern') || title.includes('software')) return 'Infosys';
                            return cName || 'Infosys';
                          })()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-medium">
                          <MapPin className="w-3.5 h-3.5" /> {app.location || 'Remote'}
                        </span>
                      </p>
                      <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex-wrap">
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
                      isAtsPassed ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}>
                      <Award className="w-4 h-4 text-indigo-500" />
                      <span>ATS Score: {atsScore}% ({isAtsPassed ? 'Passed' : 'Rejected'})</span>
                    </div>

                    <div className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border ${
                      isRejected ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
                      statusLower.includes('hired') || statusLower.includes('accepted') || offer?.status === 'Accepted' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                      statusLower.includes('offer') || Boolean(offer) ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    }`}>
                      Current Status: {offer?.status === 'Accepted' || statusLower.includes('hired') || statusLower.includes('accepted') ? 'Hired (Offer Accepted)' : (Boolean(offer) || statusLower.includes('offer') ? 'Offer Released' : app.status || 'Applied')}
                    </div>
                  </div>
                </div>

                {/* Submitted Resume & Attachments */}
                {(() => {
                  const rawResume = app.resume_url || userProfile?.resume_url;
                  const resumeUrl = resolveResumeUrl(rawResume);
                  const resumeName = rawResume ? (rawResume.split('/').pop()?.split('\\').pop() || 'Candidate_Resume.pdf') : 'Application_Resume.pdf';

                  return (
                    <div className="flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-indigo-500" />
                        <span>Submitted Resume: <strong className="text-slate-900 dark:text-white font-extrabold">{resumeName}</strong></span>
                      </div>
                      {resumeUrl && (
                        <a
                          href={resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Submitted Resume</span>
                        </a>
                      )}
                    </div>
                  );
                })()}

                {/* 2. RECRUITER RECRUITMENT PIPELINE STAGES */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Independent Recruitment Pipeline</h4>
                    <span className="text-[11px] font-bold text-slate-400">8 Recruiter Stages</span>
                  </div>

                  <div className="overflow-x-auto pb-3 pt-1">
                    <div className="flex items-center gap-1.5 min-w-[850px] xl:min-w-0 w-full justify-between">
                      {PIPELINE_STAGES.map((stage, idx) => {
                        const { text, color, isDone, isCurrent, isFailed, isWaived } = getStageStatus(app, idx);

                        return (
                          <React.Fragment key={stage.key}>
                            <div className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all whitespace-nowrap border ${color}`}>
                              <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
                                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                                 isFailed ? <X className="w-3.5 h-3.5" /> :
                                 isCurrent ? <Clock className="w-3.5 h-3.5 animate-spin" /> :
                                 <span className="text-[9px] font-bold opacity-60">{idx + 1}</span>}
                              </div>
                              <span>{isWaived ? `${stage.label} (Waived)` : stage.label}</span>
                            </div>
                            {idx < PIPELINE_STAGES.length - 1 && (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. RECRUITER STAGE DETAILS (5 SEQUENTIAL INTERVIEW & SELECTION CARDS) */}
                {(() => {
                  const techRound = app.technical_round;
                  const behavRound = app.behavioral_round;
                  const hrRound = app.hr_round;
                  const assessScore = recAssess?.score ?? app.assessment_score ?? null;

                  const isOfferIssued = Boolean(offer) || statusLower.includes('offer') || statusLower.includes('selected') || statusLower.includes('hired') || statusLower.includes('accepted');
                  const isOfferAccepted = offer?.status === 'Accepted' || statusLower.includes('hired') || statusLower.includes('accepted');

                  // True assessment conductance check - candidate MUST have actually attempted/scored
                  const isAssessConducted = Boolean(
                    (assessScore !== null && assessScore !== undefined) ||
                    (recAssess && recAssess.score !== null && recAssess.score !== undefined)
                  );
                  const actualAssessScore = isAssessConducted ? (assessScore ?? recAssess?.score) : null;
                  const passThreshold = recAssess?.passing_score ?? 70;

                  const hasAssessmentSession = Boolean(recAssess?.session_id || app.assessment_session_id);

                  const isAssessPassed = isAssessConducted && (
                    (actualAssessScore !== null && actualAssessScore >= passThreshold) ||
                    statusLower.includes('assessment pass') ||
                    recAssess?.status === 'Passed'
                  );
                  const isAssessFailed = isAssessConducted && (
                    (actualAssessScore !== null && actualAssessScore < passThreshold) ||
                    statusLower.includes('assessment fail') ||
                    recAssess?.status === 'Failed'
                  );
                  const isAssessScheduled = !isAssessConducted && Boolean(
                    recAssess?.status === 'Scheduled' || statusLower.includes('assessment scheduled')
                  );
                  const isAssessInProgress = !isAssessConducted && Boolean(
                    recAssess?.status === 'active' || recAssess?.status === 'in_progress'
                  );

                  // Gating 1: Tech requires ATS and (Assessment passed OR Tech round scheduled/completed OR Offer issued)
                  const isTechEligible = isAtsPassed && (isAssessPassed || Boolean(techRound) || Boolean(recInt) || statusLower.includes('tech passed') || isOfferIssued) && !isAssessFailed;
                  const techScore = techRound?.technical_score ?? techRound?.overall_score ?? (recInt?.technical_score ?? null);
                  const isTechFailed = !isOfferIssued && (statusLower.includes('tech failed') || statusLower.includes('technical failed') || (statusLower === 'rejected' && !behavRound && !hrRound) || techRound?.status === 'Failed');
                  const isTechPassed = isOfferIssued || (!isTechFailed && (
                    techRound?.is_passed === true ||
                    techRound?.status === 'Passed' ||
                    techRound?.status === 'Passed by Recruiter' ||
                    statusLower.includes('tech passed') || statusLower.includes('technical passed') || statusLower.includes('round 2') ||
                    statusLower.includes('move to behavioral') || statusLower.includes('behavioral') ||
                    statusLower.includes('move to hr') || statusLower.includes('hr') ||
                    statusLower.includes('selected') || statusLower.includes('offer') || statusLower.includes('hired') ||
                    statusLower.includes('interview passed') ||
                    Boolean(behavRound) || Boolean(hrRound) || Boolean(offer)
                  ));
                  const isTechConducted = Boolean(techRound?.is_conducted || techRound?.status === 'Completed' || techScore != null || isOfferIssued || isTechPassed);
                  const isTechScheduled = techRound?.status === 'Scheduled' || (recInt && recInt.status === 'Scheduled');

                  // Gating 2: Behavioral requires Technical passed
                  const isBehavEligible = isOfferIssued || (isTechEligible && isTechPassed) || Boolean(behavRound) || Boolean(hrRound) || statusLower.includes('behavioral') || statusLower.includes('hr') || statusLower.includes('offer') || statusLower.includes('selected') || statusLower.includes('hired');
                  const behavScore = behavRound?.overall_score ?? (recInt?.communication_score ?? null);
                  const isBehavFailed = !isOfferIssued && (statusLower.includes('behavioral failed') || (statusLower === 'rejected' && !hrRound && !offer) || behavRound?.status === 'Failed');
                  const isBehavPassed = isOfferIssued || (!isBehavFailed && (
                    behavRound?.is_passed === true ||
                    behavRound?.status === 'Passed' ||
                    behavRound?.status === 'Passed by Recruiter' ||
                    statusLower.includes('behavioral passed') || statusLower.includes('move to hr') || statusLower.includes('hr') ||
                    statusLower.includes('selected') || statusLower.includes('offer') || statusLower.includes('hired') ||
                    Boolean(hrRound) || Boolean(offer)
                  ));
                  const isBehavConducted = Boolean(behavRound?.is_conducted || (behavRound?.status === 'Completed') || behavScore != null || isOfferIssued || isBehavPassed);
                  const isBehavScheduled = behavRound?.status === 'Scheduled';

                  // Gating 3: HR requires Behavioral passed
                  const isHrEligible = isOfferIssued || (isBehavEligible && isBehavPassed) || Boolean(hrRound) || Boolean(offer) || statusLower.includes('hr') || statusLower.includes('offer') || statusLower.includes('selected') || statusLower.includes('hired');
                  const hrScore = hrRound?.overall_score ?? (recInt?.professionalism_score ?? null);
                  const isHrFailed = !isOfferIssued && (statusLower.includes('hr failed') || (statusLower === 'rejected' && !offer) || hrRound?.status === 'Failed');
                  const isHrPassed = isOfferIssued || (!isHrFailed && (
                    hrRound?.is_passed === true ||
                    hrRound?.status === 'Passed' ||
                    hrRound?.status === 'Passed by Recruiter' ||
                    statusLower.includes('hr passed') || statusLower.includes('hr completed') || statusLower.includes('selected') ||
                    statusLower.includes('offer') || statusLower.includes('hired') ||
                    Boolean(offer)
                  ));
                  const isHrConducted = Boolean(hrRound?.is_conducted || (hrRound?.status === 'Completed') || hrScore != null || isOfferIssued || isHrPassed);
                  const isHrScheduled = hrRound?.status === 'Scheduled';

                  // Gating 4: Offer requires HR passed or active offer
                  const isOfferEligible = isOfferIssued || (isHrEligible && isHrPassed) || statusLower.includes('offer') || statusLower.includes('selected') || statusLower.includes('hired') || Boolean(offer);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
                      
                      {/* STAGE 3: ONLINE ASSESSMENT */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3 flex flex-col justify-between transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" /> 
                              <span>Online Assessment</span>
                            </h5>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">Stage 3</span>
                          </div>

                          {isAssessConducted ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${isAssessFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'}`}>
                                  {isAssessFailed ? `Failed (<${passThreshold}%)` : `Completed (Passed ≥${passThreshold}%)`}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Assessment Score:</span>
                                <strong className={`font-black text-sm ${isAssessFailed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{actualAssessScore}%</strong>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                <span>Duration:</span>
                                <span>{recAssess?.duration_minutes || 30} Mins</span>
                              </div>
                            </div>
                          ) : isAssessScheduled ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                                  Scheduled
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                <span>Duration:</span>
                                <span>{recAssess?.duration_minutes || 30} Mins</span>
                              </div>
                            </div>
                          ) : isAssessInProgress ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 animate-pulse">
                                  In Progress
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                <span>Duration:</span>
                                <span>{recAssess?.duration_minutes || 30} Mins</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">Not Scheduled</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Aptitude / technical assessment test.
                              </p>
                            </div>
                          )}
                        </div>

                        {recAssess?.session_id && (isAssessScheduled || isAssessInProgress) ? (
                          <button
                            onClick={() => navigate(`/assessment/exam?session=${recAssess.session_id}`)}
                            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>{isAssessInProgress ? 'Resume Assessment' : 'Start Assessment'}</span>
                          </button>
                        ) : isAssessConducted && recAssess?.session_id ? (
                          <button
                            onClick={() => navigate(`/assessment/exam?session=${recAssess.session_id}`)}
                            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>View Assessment Report</span>
                          </button>
                        ) : null}
                      </div>

                      {/* STAGE 4: TECHNICAL INTERVIEW */}
                      <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                        !isTechEligible 
                          ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-purple-500 shrink-0" /> 
                              <span>Technical Interview</span>
                            </h5>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              !isTechEligible 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                : 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                            }`}>
                              {!isTechEligible ? 'Locked' : 'Stage 4'}
                            </span>
                          </div>

                          {!isTechEligible ? (
                            <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>Requires Online Assessment</span>
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Pass Stage 3 Assessment (&ge;70%) to unlock Technical interview round.
                              </p>
                            </div>
                          ) : isTechConducted || (techScore !== null && techScore !== undefined) ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  isTechPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' :
                                  isTechFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' :
                                  'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                }`}>
                                  {isTechPassed ? 'Passed by Recruiter' : isTechFailed ? 'Rejected' : 'Under Recruiter Review'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Technical Score:</span>
                                <strong className="text-purple-600 dark:text-purple-400 font-black text-sm">{techScore ?? 0}%</strong>
                              </div>
                              <div className="grid grid-cols-3 gap-1 text-[10px] font-bold text-center pt-0.5">
                                <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                  <span className="text-slate-400 block text-[8px]">TECH</span>
                                  <span className="text-slate-800 dark:text-slate-200">{techRound?.technical_score ?? (isTechConducted && techScore !== null ? techScore : 0)}%</span>
                                </div>
                                <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                  <span className="text-slate-400 block text-[8px]">COMM</span>
                                  <span className="text-slate-800 dark:text-slate-200">{techRound?.communication_score ?? (isTechConducted && techScore !== null ? techScore : 0)}%</span>
                                </div>
                                <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                  <span className="text-slate-400 block text-[8px]">CONF</span>
                                  <span className="text-slate-800 dark:text-slate-200">{techRound?.confidence_score ?? (isTechConducted && techScore !== null ? techScore : 0)}%</span>
                                </div>
                              </div>
                            </div>
                          ) : isTechScheduled ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                                  {techRound?.status || 'Scheduled'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                Date: {techRound?.scheduled_date || 'Pending'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Eligible for Technical Round</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Awaiting recruiter interview scheduling.
                              </p>
                            </div>
                          )}
                        </div>

                        {!isTechEligible ? (
                          <div className="py-2 text-center text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                            Locked
                          </div>
                        ) : techRound?.session_id && (techRound?.is_conducted || techRound?.status === 'Completed') ? (
                          <button
                            onClick={() => navigate(`/report?id=${techRound?.session_id || recInt?.session_id}`)}
                            className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Interview Report</span>
                          </button>
                        ) : (techRound?.schedule_id || recInt?.schedule_id) ? (() => {
                          const isPendingTime = isRoundPendingSchedule(techRound || recInt);
                          return (
                            <button
                              onClick={() => navigate(`/interview/lobby?schedule=${techRound?.schedule_id || recInt?.schedule_id}`)}
                              className={`w-full py-2 rounded-xl text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                                isPendingTime ? 'bg-amber-600 hover:bg-amber-500' : 'bg-purple-600 hover:bg-purple-500'
                              }`}
                            >
                              {isPendingTime ? <Clock className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                              <span>{isPendingTime ? 'Setup & Waiting Lobby' : 'Join Scheduled Round'}</span>
                            </button>
                          );
                        })() : null}
                      </div>

                      {/* STAGE 5: BEHAVIORAL INTERVIEW */}
                      <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                        !isBehavEligible 
                          ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Brain className="w-4 h-4 text-blue-500 shrink-0" /> 
                              <span>Behavioral Interview</span>
                            </h5>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              !isBehavEligible 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300'
                            }`}>
                              {!isBehavEligible ? 'Locked' : 'Stage 5'}
                            </span>
                          </div>

                          {!isBehavEligible ? (
                            <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>Requires Tech Qualification</span>
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Qualify Technical round (&ge;70%) to unlock Behavioral interview.
                              </p>
                            </div>
                          ) : isBehavConducted || (behavRound?.status === 'Completed') ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  isBehavPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' :
                                  isBehavFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' :
                                  'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                }`}>
                                  {isBehavPassed ? 'Passed by Recruiter' : isBehavFailed ? 'Rejected' : 'Under Recruiter Review'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Behavioral Score:</span>
                                <strong className="text-blue-600 dark:text-blue-400 font-black text-sm">{isBehavConducted ? (behavScore ?? 0) : 0}%</strong>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                <span>Communication / EQ:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{behavRound?.communication_score ?? (isBehavConducted && behavScore !== null ? behavScore : 0)}%</span>
                              </div>
                            </div>
                          ) : isBehavScheduled ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                                  {behavRound?.status || 'Scheduled'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                Date: {behavRound?.scheduled_date || 'Pending'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Eligible for Behavioral</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Awaiting recruiter behavioral round schedule.
                              </p>
                            </div>
                          )}
                        </div>

                        {!isBehavEligible ? (
                          <div className="py-2 text-center text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                            Locked
                          </div>
                        ) : behavRound?.session_id && (behavRound?.is_conducted || behavRound?.status === 'Completed') ? (
                          <button
                            onClick={() => navigate(`/report?id=${behavRound?.session_id}`)}
                            className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Interview Report</span>
                          </button>
                        ) : behavRound?.schedule_id ? (() => {
                          const isPendingTime = isRoundPendingSchedule(behavRound);
                          return (
                            <button
                              onClick={() => navigate(`/interview/lobby?schedule=${behavRound?.schedule_id}`)}
                              className={`w-full py-2 rounded-xl text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                                isPendingTime ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
                              }`}
                            >
                              {isPendingTime ? <Clock className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                              <span>{isPendingTime ? 'Setup & Waiting Lobby' : 'Join Scheduled Round'}</span>
                            </button>
                          );
                        })() : null}
                      </div>

                      {/* STAGE 6: HR INTERVIEW */}
                      <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                        !isHrEligible 
                          ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-teal-500 shrink-0" /> 
                              <span>HR Interview</span>
                            </h5>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              !isHrEligible 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                : 'bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300'
                            }`}>
                              {!isHrEligible ? 'Locked' : 'Stage 6'}
                            </span>
                          </div>

                          {!isHrEligible ? (
                            <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>Requires Behavioral Pass</span>
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Qualify Behavioral round (&ge;70%) to unlock HR interview.
                              </p>
                            </div>
                          ) : hrRound?.is_conducted || (hrRound?.status === 'Completed') ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  isHrPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' :
                                  isHrFailed ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300' :
                                  'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                }`}>
                                  {isHrPassed ? 'Passed by Recruiter' : isHrFailed ? 'Rejected' : 'Under Recruiter Review'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>HR Score:</span>
                                <strong className="text-teal-600 dark:text-teal-400 font-black text-sm">{isHrConducted ? (hrScore ?? 84) : 0}%</strong>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                <span>Professionalism:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{hrRound?.professionalism_score ?? (isHrConducted ? 88 : 0)}%</span>
                              </div>
                            </div>
                          ) : isHrScheduled ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                                <span>Status:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300">
                                  {hrRound?.status || 'Scheduled'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                Date: {hrRound?.scheduled_date || 'Pending'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">Eligible for HR Round</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Awaiting recruiter HR & negotiation round schedule.
                              </p>
                            </div>
                          )}
                        </div>

                        {!isHrEligible ? (
                          <div className="py-2 text-center text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                            Locked
                          </div>
                        ) : hrRound?.session_id && (hrRound?.is_conducted || hrRound?.status === 'Completed') ? (
                          <button
                            onClick={() => navigate(`/report?id=${hrRound?.session_id}`)}
                            className="w-full py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Interview Report</span>
                          </button>
                        ) : hrRound?.schedule_id ? (() => {
                          const isPendingTime = isRoundPendingSchedule(hrRound);
                          return (
                            <button
                              onClick={() => navigate(`/interview/lobby?schedule=${hrRound?.schedule_id}`)}
                              className={`w-full py-2 rounded-xl text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                                isPendingTime ? 'bg-amber-600 hover:bg-amber-500' : 'bg-teal-600 hover:bg-teal-500'
                              }`}
                            >
                              {isPendingTime ? <Clock className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                              <span>{isPendingTime ? 'Setup & Waiting Lobby' : 'Join Scheduled Round'}</span>
                            </button>
                          );
                        })() : null}
                      </div>

                      {/* STAGE 7: OFFER LETTER */}
                      <div className={`p-4 rounded-2xl border space-y-3 flex flex-col justify-between transition-colors ${
                        !isOfferEligible 
                          ? 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-85' 
                          : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" /> 
                              <span>Offer Status</span>
                            </h5>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              !isOfferEligible 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                                : 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                            }`}>
                              {!isOfferEligible ? 'Locked' : 'Stage 7'}
                            </span>
                          </div>

                          {!isOfferEligible ? (
                            <div className="space-y-1.5 py-1 text-slate-500 dark:text-slate-400 text-xs">
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>Requires HR Round Pass</span>
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Complete all interview rounds before receiving official offer letter.
                              </p>
                            </div>
                          ) : offer ? (
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
                                <span>Salary:</span>
                                <strong className="text-amber-700 dark:text-amber-400 font-extrabold text-sm">{offer.salary_offered || '$135,000 / yr'}</strong>
                              </div>
                              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
                                <span>Joining Date:</span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">{offer.start_date || 'ASAP'}</span>
                              </div>
                              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-medium">
                                <span>Location:</span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">{app.location || 'Remote'}</span>
                              </div>

                              {offer.status === 'Accepted' ? (
                                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-black text-center mt-2">
                                  🎉 Offer Accepted! Welcome aboard!
                                </div>
                              ) : offer.status === 'Rejected' ? (
                                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 text-xs font-black text-center mt-2">
                                  Offer Declined
                                </div>
                              ) : (
                                <div className="space-y-2 pt-1">
                                  <button
                                    onClick={() => alert(`Official Offer Letter:\n\n${offer.offer_letter_text || 'Congratulations! You are officially offered the position.'}`)}
                                    className="w-full py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download Offer Letter
                                  </button>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => handleOfferResponse(offer.id, 'accept')}
                                      disabled={respondingOfferId === offer.id}
                                      className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Accept
                                    </button>
                                    <button
                                      onClick={() => handleOfferResponse(offer.id, 'decline')}
                                      disabled={respondingOfferId === offer.id}
                                      className="py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" /> Reject
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1 py-1">
                              <p className="text-xs font-extrabold text-amber-700 dark:text-amber-400">Decision Pending</p>
                              <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 font-medium leading-relaxed">
                                Recruiter is reviewing all completed interview rounds and video to make official offer decision.
                              </p>
                            </div>
                          )}
                        </div>

                        {!isOfferEligible ? (
                          <div className="py-2 text-center text-slate-400 dark:text-slate-500 text-[11px] font-bold">
                            Locked
                          </div>
                        ) : null}
                      </div>

                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
};
