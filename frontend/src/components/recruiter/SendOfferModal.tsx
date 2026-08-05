import React, { useState } from 'react';
import { X, Award, Send, DollarSign, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

interface SendOfferModalProps {
  application: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SendOfferModal: React.FC<SendOfferModalProps> = ({ application, isOpen, onClose, onSuccess }) => {
  const [salaryOffered, setSalaryOffered] = useState('$145,000 / year');
  const [startDate, setStartDate] = useState('2026-08-15');
  const [offerText, setOfferText] = useState('We are thrilled to offer you the position at SmartHire AI Corporate!');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !application) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setErrorMsg('');

    try {
      await api.post('/recruiter/offer/send', {
        application_id: application.id,
        salary_offered: salaryOffered,
        start_date: startDate,
        offer_letter_text: offerText
      });

      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to send offer letter.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl w-full max-w-lg space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Issue Formal Offer Letter</h2>
              <p className="text-xs text-slate-500 font-medium">Candidate: {application.candidate_name}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Offer Letter Issued!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              The official offer letter has been sent to {application.candidate_name}'s candidate dashboard.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Position Title</label>
              <input
                type="text"
                disabled
                value={application.job_title}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Annual Salary Compensation</label>
              <input
                type="text"
                value={salaryOffered}
                onChange={(e) => setSalaryOffered(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Anticipated Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Offer Details & Terms</label>
              <textarea
                rows={3}
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Issuing Offer...' : 'Send Offer Letter'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

