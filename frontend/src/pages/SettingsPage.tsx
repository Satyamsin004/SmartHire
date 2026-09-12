import React, { useState, useEffect, useRef } from 'react';
import { SettingsSecurityIllustration } from '../components/illustrations/Illustrations';
import { Settings, Shield, User, Save, Lock, Camera, Trash2, Upload } from 'lucide-react';
import api from '../services/api';

export const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncUserData = () => {
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
  };

  useEffect(() => {
    syncUserData();
    window.addEventListener('user_profile_updated', syncUserData);
    return () => window.removeEventListener('user_profile_updated', syncUserData);
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarError('');
    setAvatarSuccess('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/uploads/avatar', formData);
      const newUrl = res.data?.profile_image || res.data?.avatar_url || res.data?.url;
      if (newUrl) {
        const updated = { ...user, profile_image: newUrl, avatar_url: newUrl };
        setUser(updated);
        localStorage.setItem('user_data', JSON.stringify(updated));
        localStorage.setItem('user', JSON.stringify(updated));
        window.dispatchEvent(new Event('user_profile_updated'));
        setAvatarSuccess('Profile photo uploaded and updated successfully.');
        setTimeout(() => setAvatarSuccess(''), 3000);
      }
    } catch (err: any) {
      console.warn('Avatar upload error:', err);
      setAvatarError(err?.response?.data?.detail || 'Failed to upload photo. Please try a JPG or PNG under 5MB.');
      setTimeout(() => setAvatarError(''), 4000);
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await api.delete('/uploads/avatar');
    } catch (e) {}
    const updated = { ...user, profile_image: null, avatar_url: null };
    setUser(updated);
    localStorage.setItem('user_data', JSON.stringify(updated));
    localStorage.setItem('user', JSON.stringify(updated));
    window.dispatchEvent(new Event('user_profile_updated'));
    setAvatarSuccess('Profile photo removed.');
    setTimeout(() => setAvatarSuccess(''), 3000);
  };

  const handleSave = () => {
    if (!user) return;
    const updated = { ...user, full_name: fullName };
    localStorage.setItem('user_data', JSON.stringify(updated));
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
    window.dispatchEvent(new Event('user_profile_updated'));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : (fullName ? fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'AR');

  const avatarUrl = user?.profile_image || user?.avatar_url || null;

  return (
    <>
        <main className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          <div className="bg-gradient-to-r from-brand-primary via-indigo-950 to-slate-950 rounded-5xl p-8 lg:p-12 text-white relative overflow-hidden shadow-floating border border-indigo-900/30">
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
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-bold">
              Account settings updated successfully.
            </div>
          )}

          {avatarSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              {avatarSuccess}
            </div>
          )}

          {avatarError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold">
              {avatarError}
            </div>
          )}

          <div className="card-luxury p-8 max-w-2xl space-y-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm">
            {/* Profile Avatar Upload Section */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Click to change photo">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-600 to-slate-900 dark:from-indigo-500 dark:to-purple-700 text-white font-black text-2xl flex items-center justify-center shadow-md overflow-hidden border-2 border-indigo-500/40">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user?.full_name || 'Profile'} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-1 text-center sm:text-left">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Profile Photo</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a professional picture (JPG, PNG, or WEBP, max 5MB).
                </p>
                <div className="flex items-center gap-2 pt-2 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink dark:text-white mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-cream-100 dark:bg-slate-800 border border-stoneBorder dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-brand-ink dark:text-white focus:outline-none focus:border-brand-primary dark:focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink dark:text-white mb-2">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full bg-cream-200 dark:bg-slate-800/50 border border-stoneBorder dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-brand-ink dark:text-white mb-2">Portal Role</label>
              <input
                type="text"
                disabled
                value={user?.role || 'candidate'}
                className="w-full bg-cream-200 dark:bg-slate-800/50 border border-stoneBorder dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase cursor-not-allowed"
              />
            </div>

            <button
              onClick={handleSave}
              className="py-3.5 px-8 rounded-2xl bg-brand-primary dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-luxury transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>

        </main>
      </>
  );
};

