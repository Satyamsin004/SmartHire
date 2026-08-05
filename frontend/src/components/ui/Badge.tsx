import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'indigo' | 'mint' | 'dark' | 'amber' | 'rose' | 'slate';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'mint', size = 'md' }) => {
  const variants = {
    indigo: 'bg-brand-primary text-brand-bg font-bold',
    mint: 'bg-brand-accent text-brand-ink font-extrabold',
    dark: 'bg-brand-ink text-brand-accent font-bold',
    amber: 'bg-amber-100 text-amber-800 font-bold',
    rose: 'bg-rose-100 text-rose-800 font-bold',
    slate: 'bg-stone-200 text-stone-700 font-bold'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] rounded-lg',
    md: 'px-3 py-1 text-xs rounded-xl'
  };

  return (
    <span className={`inline-flex items-center gap-1 ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
};

