import React, { useState } from 'react';
import { Building, Users, Bell, Key, ShieldCheck, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const RecruiterSettings: React.FC = () => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('SmartHire AI Corporate');
  const [companyDomain, setCompanyDomain] = useState('smarthire.ai');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [webSocketAlerts, setWebSocketAlerts] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">RECRUITER WORKSPACE SETTINGS</span>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
          ATS & Organization Configuration
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Manage your hiring team, ATS integration keys, candidate notification channels, and company profile.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          Settings saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Company Profile Card */}
        <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Company & Workspace Profile</h3>
              <p className="text-xs text-slate-400 font-medium">Displayed to candidates on interview invitation emails</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Domain Name</label>
              <input
                type="text"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Hiring Team & RBAC Card */}
        <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Authenticated Recruiter Account</h3>
              <p className="text-xs text-slate-400 font-medium">Role-Based Access Control (RBAC) details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Account Name</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{user?.full_name || 'Abhay Recruiter'}</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Role Privilege</span>
              <span className="font-extrabold text-indigo-600 text-sm mt-0.5 block capitalize">{user?.role || 'Recruiter'} (Enterprise)</span>
            </div>
          </div>
        </div>

        {/* Notifications & Live WebSocket Settings */}
        <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Real-Time Event Alerts</h3>
              <p className="text-xs text-slate-400 font-medium">Instant alerts when candidates register or complete AI interviews</p>
            </div>
          </div>

          <div className="space-y-3 text-xs font-semibold text-slate-700">
            <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer">
              <span>Enable Email Notifications for Interview Completions</span>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer">
              <span>Enable Live WebSocket Desktop Alerts</span>
              <input
                type="checkbox"
                checked={webSocketAlerts}
                onChange={(e) => setWebSocketAlerts(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="py-3.5 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Save className="w-4 h-4" />
            Save Organization Settings
          </button>
        </div>
      </form>
    </div>
  );
};

