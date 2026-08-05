import React from 'react';
import { X, Award, CheckCircle2, Download, BarChart2 } from 'lucide-react';

interface CandidateComparisonModalProps {
  candidates: any[];
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateComparisonModal: React.FC<CandidateComparisonModalProps> = ({ candidates, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Side-by-Side Candidate Comparison Matrix</h2>
              <p className="text-xs text-slate-400 font-semibold">Comparing AI Scores, Communication, Technical Depth, and ATS Match</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => alert("Exporting comparison report to Excel / CSV...")}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export Report
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Metric / Dimension</th>
                {candidates.map((c) => (
                  <th key={c.id} className="py-3 px-4 text-slate-900 font-black">
                    {c.name}
                    <span className="block text-[11px] text-slate-400 font-medium">{c.role}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
              <tr>
                <td className="py-4 px-4 font-extrabold text-slate-500">Overall AI Score</td>
                {candidates.map((c) => (
                  <td key={c.id} className="py-4 px-4">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-sm">
                      {c.overall_score || 85.0}
                    </span>
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-4 px-4 font-extrabold text-slate-500">Communication (30%)</td>
                {candidates.map((c) => (
                  <td key={c.id} className="py-4 px-4 text-slate-700 font-bold">{c.communication_score || 88.0}</td>
                ))}
              </tr>

              <tr>
                <td className="py-4 px-4 font-extrabold text-slate-500">Confidence (25%)</td>
                {candidates.map((c) => (
                  <td key={c.id} className="py-4 px-4 text-slate-700 font-bold">{c.confidence_score || 85.0}</td>
                ))}
              </tr>

              <tr>
                <td className="py-4 px-4 font-extrabold text-slate-500">Technical Depth (30%)</td>
                {candidates.map((c) => (
                  <td key={c.id} className="py-4 px-4 text-slate-700 font-bold">{c.technical_score || 82.0}</td>
                ))}
              </tr>

              <tr>
                <td className="py-4 px-4 font-extrabold text-slate-500">ATS Resume Match</td>
                {candidates.map((c) => (
                  <td key={c.id} className="py-4 px-4 text-indigo-600 font-extrabold">{c.ats_score || 88.5}%</td>
                ))}
              </tr>

              <tr>
                <td className="py-4 px-4 font-extrabold text-slate-500">Recruiter Status</td>
                {candidates.map((c) => (
                  <td key={c.id} className="py-4 px-4">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-[11px]">
                      {c.status || 'Applied'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-3">
          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
          >
            Close Matrix
          </button>
        </div>

      </div>
    </div>
  );
};

