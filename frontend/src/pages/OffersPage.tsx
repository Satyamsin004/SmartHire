import React, { useState, useEffect } from 'react';
import { Gift, CheckCircle2, XCircle, Clock, Building2, DollarSign, Calendar } from 'lucide-react';
import api from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

export const OffersPage: React.FC = () => {
  const { lastMessage } = useWebSocket();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = () => {
    api.get('/offers/my-offers')
      .then((res) => {
        setOffers(res.data || []);
      })
      .catch((err) => {
        console.warn('Fetch offers error:', err);
        setOffers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  // Real-time synchronization whenever WebSocket message arrives
  useEffect(() => {
    if (lastMessage) {
      fetchOffers();
    }
  }, [lastMessage]);

  const handleAccept = async (offerId: string) => {
    try {
      await api.post(`/offers/${offerId}/respond`, { action: 'Accept' });
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: 'Accepted' } : o));
    } catch (err) {
      console.error('Accept offer error:', err);
    }
  };

  const handleDecline = async (offerId: string) => {
    try {
      await api.post(`/offers/${offerId}/respond`, { action: 'Decline' });
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: 'Rejected' } : o));
    } catch (err) {
      console.error('Decline offer error:', err);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Accepted':
      case 'Hired':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300';
      case 'Declined':
      case 'Rejected':
        return 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300';
      default:
        return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
    }
  };

  return (
    <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Offer Letters</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Review formal employment offers received from recruiters.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-extrabold text-brand-ink dark:text-white mb-2">Received Offer Letters ({offers.length})</h3>

        {loading ? (
          <div className="p-12 text-center bg-cream-100 dark:bg-[#111827] rounded-3xl border border-stoneBorder dark:border-slate-800">
            <Clock className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-extrabold text-brand-ink dark:text-white">Loading offers...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center bg-cream-100 dark:bg-[#111827] rounded-3xl border border-stoneBorder dark:border-slate-800">
            <Gift className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-extrabold text-brand-ink dark:text-white">No Offers Received Yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Complete recruiter interview evaluations to receive formal employment offer letters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((off) => (
              <div key={off.id} className="card-luxury p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 text-[10px] font-extrabold uppercase">
                    Official Offer Letter
                  </span>
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold ${getStatusStyle(off.status)}`}>
                    {off.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-brand-ink dark:text-white">{off.job_title || 'Software Role'}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{off.company_name || 'Enterprise Employer'}</p>
                  </div>
                </div>

                {off.salary_range && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream-100 dark:bg-slate-800/60 border border-stoneBorder dark:border-slate-700">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-brand-ink dark:text-white">{off.salary_range}</span>
                  </div>
                )}

                {off.applied_at && (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Applied: {new Date(off.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}

                {!['Accepted', 'Declined', 'Hired'].includes(off.status) && (
                  <div className="pt-4 border-t border-stoneBorder dark:border-slate-800 flex justify-end gap-3">
                    <button 
                      onClick={() => handleDecline(off.id)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-[11px] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Decline
                    </button>
                    <button 
                      onClick={() => handleAccept(off.id)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] shadow-soft transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Accept Offer
                    </button>
                  </div>
                )}

                {off.status === 'Accepted' && (
                  <div className="pt-4 border-t border-stoneBorder dark:border-slate-800 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-extrabold">Offer Accepted</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
