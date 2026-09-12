import React from 'react';
import { TrendingUp, LucideIcon } from 'lucide-react';
import target3dImg from '../../assets/welcome_target_3d.jpg';

export interface HeroMetric {
  label: string;
  value: string | number;
  subtext?: string;
}

interface WelcomeHeroCardProps {
  userName: string;
  greeting?: string;
  icon?: LucideIcon;
  metrics: [HeroMetric, HeroMetric];
  className?: string;
  badgeText?: string;
  actionButton?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export const WelcomeHeroCard: React.FC<WelcomeHeroCardProps> = ({
  userName,
  greeting = 'Welcome Back',
  icon: Icon = TrendingUp,
  metrics,
  className = '',
  badgeText,
  actionButton,
}) => {
  const m1 = metrics?.[0] || { label: 'Readiness', value: '85%' };
  const m2 = metrics?.[1] || { label: 'Pipeline', value: 'Active' };

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#4E44CE] via-[#5850EC] to-[#6366F1] p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/20 border border-indigo-400/30 flex flex-col justify-between transition-all duration-300 ${className}`}
    >
      {/* Subtle Background Glow Orbs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Left Information Section */}
        <div className="space-y-6 flex-1 max-w-xl">
          
          {/* Top: Icon + Greeting */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white text-[#5850EC] shadow-lg flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              {badgeText && (
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-white border border-white/20 mb-1 backdrop-blur-sm">
                  {badgeText}
                </span>
              )}
              <p className="text-xs sm:text-sm font-semibold text-indigo-100/90 tracking-wide">
                {greeting}
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-xs">
                {userName || 'Candidate'}
              </h1>
            </div>
          </div>

          {/* Bottom: Dual Metric Columns with Divider */}
          <div className="flex items-center pt-2">
            {/* Metric 1 */}
            <div className="pr-5 sm:pr-8">
              <p className="text-[11px] sm:text-xs font-medium text-indigo-100/80 mb-0.5">
                {m1.label}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {m1.value}
              </p>
              {m1.subtext && (
                <p className="text-[10px] text-indigo-200/80 mt-0.5">
                  {m1.subtext}
                </p>
              )}
            </div>

            {/* Vertical Line Divider */}
            <div className="w-px h-12 bg-white/25 mx-2" />

            {/* Metric 2 */}
            <div className="pl-5 sm:pl-8">
              <p className="text-[11px] sm:text-xs font-medium text-indigo-100/80 mb-0.5">
                {m2.label}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {m2.value}
              </p>
              {m2.subtext && (
                <p className="text-[10px] text-indigo-200/80 mt-0.5">
                  {m2.subtext}
                </p>
              )}
            </div>
          </div>

          {/* Optional Action Button */}
          {actionButton && (
            <div className="pt-1">
              <button
                onClick={actionButton.onClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#5850EC] hover:bg-indigo-50 font-black text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                {actionButton.icon && <actionButton.icon className="w-4 h-4" />}
                <span>{actionButton.label}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right 3D Bullseye Target Illustration */}
        <div className="relative shrink-0 self-center lg:self-auto flex items-center justify-center">
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 group">
            <img
              src={target3dImg}
              alt="SmartHire 3D Bullseye Goal"
              className="w-full h-full object-contain rounded-2xl drop-shadow-[0_15px_25px_rgba(0,0,0,0.35)] transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
