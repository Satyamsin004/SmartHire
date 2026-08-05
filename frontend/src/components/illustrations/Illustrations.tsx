import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

// 1. Login Landing Illustration
export const LoginLandingIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 600 450" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="loginBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B0F1B" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.05" />
      </linearGradient>
      <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B0F1B" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#4F46E5" />
      </linearGradient>
    </defs>
    {/* Canvas Background */}
    <rect width="600" height="450" rx="32" fill="url(#loginBg)" />
    
    {/* Floating Decorative Orbs */}
    <circle cx="100" cy="80" r="45" fill="#818CF8" opacity="0.3" className="animate-pulse-glow" />
    <circle cx="500" cy="380" r="65" fill="#4F46E5" opacity="0.15" />

    {/* Central Laptop & AI Holographic Interface */}
    <rect x="140" y="160" width="320" height="200" rx="16" fill="#0F172A" />
    <rect x="152" y="172" width="296" height="176" rx="10" fill="#F8FAFC" />
    
    {/* Laptop Base */}
    <path d="M100 360 H500 C510 360 516 368 510 376 L480 395 C476 398 470 400 460 400 H140 C130 400 124 398 120 395 L90 376 C84 368 90 360 100 360 Z" fill="#0B0F1B" />
    <rect x="250" y="365" width="100" height="6" rx="3" fill="#818CF8" />

    {/* Screen Content - Dashboard Widgets */}
    <rect x="170" y="190" width="120" height="60" rx="8" fill="#FFFFFF" stroke="#E7E5E4" />
    <circle cx="190" cy="210" r="10" fill="#4F46E5" />
    <rect x="208" y="206" width="60" height="8" rx="4" fill="#0B0F1B" />
    <rect x="208" y="220" width="40" height="6" rx="3" fill="#6B7280" />

    <rect x="306" y="190" width="124" height="60" rx="8" fill="url(#indigoGrad)" />
    <text x="320" y="215" fill="#F8FAFC" fontSize="12" fontWeight="700">AI Match Rate</text>
    <text x="320" y="236" fill="#818CF8" fontSize="18" fontWeight="800">98.4%</text>

    {/* Candidate Profile Avatar & Match Beam */}
    <g transform="translate(170, 265)">
      <rect width="260" height="65" rx="10" fill="#FFFFFF" stroke="#E7E5E4" />
      <circle cx="35" cy="32" r="18" fill="#0B0F1B" />
      <path d="M35 22 C30 22 26 26 26 30 C26 34 30 38 35 38 C40 38 44 34 44 30 C44 26 40 22 35 22 Z" fill="#818CF8" />
      <rect x="65" y="22" width="110" height="8" rx="4" fill="#0F172A" />
      <rect x="65" y="36" width="70" height="6" rx="3" fill="#6B7280" />
      <rect x="190" y="20" width="55" height="24" rx="12" fill="#4F46E5" />
      <text x="202" y="36" fill="#FFFFFF" fontSize="10" fontWeight="700">HIRED</text>
    </g>

    {/* Floating Holographic AI Node Badge */}
    <g transform="translate(420, 80)" className="animate-float-slow">
      <rect width="130" height="70" rx="16" fill="#FFFFFF" stroke="#818CF8" strokeWidth="2" />
      <circle cx="30" cy="35" r="14" fill="#0B0F1B" />
      <path d="M30 26 L34 35 L30 32 L26 35 Z" fill="#818CF8" />
      <text x="52" y="32" fill="#0F172A" fontSize="11" fontWeight="800">Gemini 1.5</text>
      <text x="52" y="46" fill="#4F46E5" fontSize="10" fontWeight="600">Smart Audit Active</text>
    </g>
  </svg>
);

// 2. Signup Onboarding Illustration
export const SignupOnboardingIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 600 450" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="600" height="450" rx="32" fill="#F8FAFC" />
    <circle cx="300" cy="225" r="180" fill="#0B0F1B" opacity="0.06" />
    
    {/* Rocket Career Growth Vector */}
    <g transform="translate(240, 100)" className="animate-float-slow">
      <path d="M60 0 C60 0 110 50 110 130 L70 170 L30 170 L0 130 C0 50 60 0 60 0 Z" fill="#0B0F1B" />
      <circle cx="60" cy="65" r="22" fill="#F8FAFC" stroke="#4F46E5" strokeWidth="4" />
      <circle cx="60" cy="65" r="10" fill="#0B0F1B" />
      <path d="M30 170 L10 220 L60 190 L110 220 L90 170 Z" fill="#4F46E5" />
      <path d="M45 190 L60 250 L75 190 Z" fill="#818CF8" />
    </g>

    {/* Steps Card Timeline */}
    <g transform="translate(100, 290)">
      <rect width="400" height="100" rx="20" fill="#FFFFFF" stroke="#E7E5E4" />
      
      <circle cx="60" cy="50" r="20" fill="#0B0F1B" />
      <text x="55" y="56" fill="#F8FAFC" fontSize="16" fontWeight="800">1</text>
      <rect x="95" y="38" width="80" height="8" rx="4" fill="#0F172A" />
      <rect x="95" y="52" width="60" height="6" rx="3" fill="#6B7280" />

      <line x1="195" y1="50" x2="225" y2="50" stroke="#4F46E5" strokeWidth="3" strokeDasharray="4 4" />

      <circle cx="260" cy="50" r="20" fill="#4F46E5" />
      <text x="255" y="56" fill="#FFFFFF" fontSize="16" fontWeight="800">2</text>
      <rect x="295" y="38" width="80" height="8" rx="4" fill="#0F172A" />
      <rect x="295" y="52" width="60" height="6" rx="3" fill="#6B7280" />
    </g>
  </svg>
);

// 3. Candidate Hero Story Illustration
export const CandidateHeroStoryIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 500 350" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="500" height="350" rx="24" fill="transparent" />
    
    {/* Storytelling Growth Curve */}
    <path d="M40 280 C120 280 180 200 250 180 C320 160 380 90 460 60" stroke="#818CF8" strokeWidth="6" strokeLinecap="round" />
    <path d="M40 280 C120 280 180 200 250 180 C320 160 380 90 460 60 L460 320 L40 320 Z" fill="url(#heroCurveGrad)" opacity="0.2" />
    
    <defs>
      <linearGradient id="heroCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5" />
        <stop offset="100%" stopColor="#0B0F1B" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Hero Candidate Avatar with Holographic Trophy */}
    <circle cx="440" cy="60" r="28" fill="#818CF8" />
    <path d="M432 50 L448 50 L448 64 C448 70 440 76 440 76 C440 76 432 70 432 64 Z" fill="#0B0F1B" />

    {/* Metric Badge Cards (Abstract Vector) */}
    <g transform="translate(60, 80)" className="animate-float-slow">
      <rect width="160" height="80" rx="16" fill="#FFFFFF" stroke="#E7E5E4" />
      <rect x="20" y="24" width="80" height="8" rx="4" fill="#0B0F1B" opacity="0.6" />
      <rect x="20" y="44" width="110" height="12" rx="6" fill="#4F46E5" />
      <circle cx="130" cy="40" r="14" fill="#E6F7EF" />
      <path d="M125 40 L128 43 L135 36" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    <g transform="translate(250, 180)">
      <rect width="180" height="75" rx="16" fill="#0B0F1B" />
      <rect x="20" y="22" width="90" height="8" rx="4" fill="#818CF8" />
      <rect x="20" y="42" width="130" height="12" rx="6" fill="#F8FAFC" />
    </g>
  </svg>
);

// 4. Recruiter Hiring Team Illustration
export const RecruiterHiringTeamIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 500 350" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="500" height="350" rx="24" fill="transparent" />

    {/* Team Analytics Funnel Vector */}
    <g transform="translate(50, 40)">
      <path d="M0 0 L400 0 L280 240 L120 240 Z" fill="#0B0F1B" opacity="0.1" />
      
      {/* Funnel Stage Bars */}
      <rect x="20" y="20" width="360" height="40" rx="8" fill="#0B0F1B" />
      <rect x="50" y="75" width="300" height="40" rx="8" fill="#4F46E5" />
      <rect x="80" y="130" width="240" height="40" rx="8" fill="#818CF8" />
      <rect x="110" y="185" width="180" height="40" rx="8" fill="#0F172A" />
    </g>

    {/* Floating Candidate Card */}
    <g transform="translate(280, 200)" className="animate-float-slow">
      <rect width="180" height="100" rx="16" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2" />
      <circle cx="35" cy="35" r="16" fill="#0B0F1B" />
      <rect x="60" y="25" width="90" height="8" rx="4" fill="#0F172A" />
      <rect x="60" y="38" width="60" height="6" rx="3" fill="#6B7280" />
      <rect x="20" y="65" width="140" height="20" rx="6" fill="#E6F7EF" />
    </g>
  </svg>
);

// 5. AI Interviewer Studio Illustration
export const AIInterviewerStudioIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 500 350" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="500" height="350" rx="24" fill="#0F172A" />
    
    {/* Holographic Sound Wave Sphere */}
    <circle cx="250" cy="150" r="85" fill="#0B0F1B" opacity="0.4" className="animate-pulse-glow" />
    <circle cx="250" cy="150" r="60" fill="url(#aiSphereGrad)" />
    
    <defs>
      <linearGradient id="aiSphereGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5" />
        <stop offset="100%" stopColor="#0B0F1B" />
      </linearGradient>
    </defs>

    {/* Robot Eye & Core */}
    <circle cx="230" cy="140" r="8" fill="#818CF8" />
    <circle cx="270" cy="140" r="8" fill="#818CF8" />
    <path d="M235 165 Q250 175 265 165" stroke="#818CF8" strokeWidth="4" strokeLinecap="round" fill="none" />

    {/* Live Voice Frequency Bar Equalizer */}
    <g transform="translate(150, 260)">
      {[20, 45, 70, 30, 85, 60, 95, 40, 75, 50, 30, 80, 40].map((h, i) => (
        <rect key={i} x={i * 16} y={60 - h / 2} width="8" height={h} rx="4" fill={i % 2 === 0 ? "#818CF8" : "#4F46E5"} />
      ))}
    </g>
  </svg>
);

// 6. Resume Upload & Scanner Illustration
export const ResumeUploadIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="400" height="300" rx="24" fill="#F8FAFC" />
    
    {/* PDF Document Document Vector */}
    <g transform="translate(120, 40)">
      <rect width="160" height="210" rx="12" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="2" />
      
      {/* Header Bar */}
      <rect x="20" y="25" width="120" height="12" rx="6" fill="#0B0F1B" />
      <rect x="20" y="48" width="80" height="8" rx="4" fill="#6B7280" />
      
      {/* Lines of Resume Content */}
      <rect x="20" y="70" width="120" height="6" rx="3" fill="#E7E5E4" />
      <rect x="20" y="84" width="100" height="6" rx="3" fill="#E7E5E4" />
      <rect x="20" y="98" width="110" height="6" rx="3" fill="#E7E5E4" />

      {/* Skills Badges inside Resume */}
      <rect x="20" y="125" width="45" height="16" rx="8" fill="#E6F7EF" />
      <rect x="70" y="125" width="45" height="16" rx="8" fill="#E6F7EF" />
      <rect x="20" y="148" width="55" height="16" rx="8" fill="#E6F7EF" />

      {/* Laser Scanning Line */}
      <line x1="0" y1="110" x2="160" y2="110" stroke="#4F46E5" strokeWidth="4" className="animate-pulse" />
    </g>

    {/* Scanner Success Ring */}
    <g transform="translate(250, 180)" className="animate-float-slow">
      <circle cx="30" cy="30" r="28" fill="#0B0F1B" />
      <path d="M20 30 L27 37 L42 22" stroke="#818CF8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

// 7. ATS Radar Scan Illustration
export const ATSScanIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="400" height="300" rx="24" fill="#0F172A" />
    
    {/* Radar Radar Target Grid */}
    <circle cx="200" cy="150" r="110" stroke="#0B0F1B" strokeWidth="2" fill="none" />
    <circle cx="200" cy="150" r="75" stroke="#4F46E5" strokeWidth="2" strokeDasharray="6 6" fill="none" />
    <circle cx="200" cy="150" r="40" stroke="#818CF8" strokeWidth="2" fill="none" />
    
    {/* Radar Scanning Beam */}
    <path d="M200 150 L280 70 A110 110 0 0 1 310 150 Z" fill="url(#radarBeamGrad)" />
    
    <defs>
      <linearGradient id="radarBeamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#0B0F1B" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Target Candidate Nodes */}
    <circle cx="260" cy="95" r="8" fill="#818CF8" className="animate-pulse" />
    <circle cx="150" cy="190" r="6" fill="#4F46E5" />
    <circle cx="240" cy="200" r="7" fill="#818CF8" />
  </svg>
);

// 8. Offer Celebration Illustration
export const OfferCelebrationIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="400" height="300" rx="24" fill="#F8FAFC" />
    
    {/* Wax Sealed Envelope */}
    <g transform="translate(100, 50)">
      <rect width="200" height="150" rx="16" fill="#0B0F1B" />
      <path d="M0 0 L100 80 L200 0 Z" fill="#4F46E5" />
      
      {/* Wax Seal Emblem */}
      <circle cx="100" cy="80" r="24" fill="#818CF8" stroke="#0F172A" strokeWidth="3" />
      <path d="M92 80 L98 86 L108 72" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    {/* Confetti Explosion Streamers */}
    <circle cx="70" cy="60" r="6" fill="#4F46E5" />
    <circle cx="330" cy="80" r="8" fill="#0B0F1B" />
    <rect x="60" y="160" width="12" height="12" rx="3" fill="#818CF8" transform="rotate(45 60 160)" />
    <rect x="320" y="180" width="14" height="14" rx="4" fill="#4F46E5" transform="rotate(25 320 180)" />
  </svg>
);

// 9. Error 404 AI Robot Illustration
export const Error404RobotIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="400" height="300" rx="24" fill="#F8FAFC" />
    
    <g transform="translate(150, 60)">
      {/* Robot Head */}
      <rect x="20" y="20" width="60" height="50" rx="12" fill="#0B0F1B" />
      <circle cx="38" cy="40" r="6" fill="#818CF8" />
      <circle cx="62" cy="40" r="6" fill="#818CF8" />
      
      {/* Antenna */}
      <line x1="50" y1="20" x2="50" y2="5" stroke="#4F46E5" strokeWidth="4" />
      <circle cx="50" cy="5" r="5" fill="#4F46E5" />

      {/* Disconnected Plug Cable */}
      <path d="M50 70 L50 120 C50 140 10 140 10 160" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="0" y="160" width="20" height="12" rx="3" fill="#6B7280" />
    </g>

    <text x="200" y="240" textAnchor="middle" fill="#0B0F1B" fontSize="32" fontWeight="800">404</text>
    <text x="200" y="265" textAnchor="middle" fill="#6B7280" fontSize="13" fontWeight="600">Page Not Found in SmartHire AI</text>
  </svg>
);

// 10. Empty State Professional Illustration
export const EmptyStateProfessionalIllustration: React.FC<IllustrationProps> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="300" height="200" rx="16" fill="#F8FAFC" />
    <circle cx="150" cy="90" r="45" fill="#E6F7EF" />
    <rect x="125" y="70" width="50" height="40" rx="8" fill="#0B0F1B" />
    <path d="M140 85 L147 92 L160 78" stroke="#818CF8" strokeWidth="3" strokeLinecap="round" />
    <rect x="90" y="150" width="120" height="8" rx="4" fill="#E7E5E4" />
  </svg>
);

// Export all additional aliases for seamless drop-in
export const AIAssistantIllustration = LoginLandingIllustration;
export const RecruiterAnalyticsIllustration = RecruiterHiringTeamIllustration;
export const VideoRoomIllustration = AIInterviewerStudioIllustration;
export const ResumeAnalysisIllustration = ResumeUploadIllustration;
export const ReportsAnalyticsIllustration = ATSScanIllustration;
export const NotificationsCommIllustration = OfferCelebrationIllustration;
export const SettingsSecurityIllustration = ATSScanIllustration;
export const EmptyStateIllustration = EmptyStateProfessionalIllustration;

