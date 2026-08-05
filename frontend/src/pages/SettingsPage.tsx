import React, { useState, useEffect } from 'react';
import { SettingsSecurityIllustration } from '../components/illustrations/Illustrations';
import { Settings, Shield, User, Save, Lock } from 'lucide-react';
import api from '../services/api';

export const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
        setFullName(u.full_name || '');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSave = () => {
    if (!user) return;
    const updated = { ...user, full_name: fullName };
    localStorage.setItem('user_data', JSON.stringify(updated));
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>

        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          <div className="bg-gradient-to-r from-brand-primary via-sb-800 to-brand-ink rounded-5xl p-8 lg:p-12 text-white relative overflow-hidden shadow-floating">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                  <Shield className="w-4 h-4" />
                  <span>Account Governance & Security</span>
                </div>
                <h1 className="text-3xl lg:text-5xl font-extrabold tracking-tight text-white">
                  User Preferences & Controls
                </h1>
              </div>

              <div className="lg:col-span-5 hidden lg:block">
                <SettingsSecurityIllustration className="w-full h-auto drop-shadow-2xl" />
              </div>
            </div>
          </div>

          {saved && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">
              Account settings updated successfully.
            </div>
          )}

          <div className="card-luxury p-8 max-w-2xl space-y-6">
            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-cream-100 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-2">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full bg-cream-200 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink mb-2">Portal Role</label>
              <input
                type="text"
                disabled
                value={user?.role || 'candidate'}
                className="w-full bg-cream-200 border border-stoneBorder rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-not-allowed"
              />
            </div>

            <button
              onClick={handleSave}
              className="py-3.5 px-8 rounded-2xl bg-brand-primary hover:bg-sb-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>

        </main>
      </>
  );
};

