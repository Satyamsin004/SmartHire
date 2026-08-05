import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'indigo' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm";
  
  const variants = {
    primary: "bg-brand-primary text-brand-bg hover:bg-sb-700 shadow-soft hover:shadow-luxury-hover border border-transparent",
    secondary: "bg-brand-ink text-brand-bg hover:bg-ink-950 shadow-soft border border-transparent",
    indigo: "bg-brand-secondary text-white hover:bg-sb-600 shadow-soft hover:shadow-luxury-hover border border-transparent",
    outline: "bg-white text-brand-ink border border-stoneBorder hover:bg-cream-200 hover:border-brand-secondary",
    ghost: "bg-transparent text-brand-ink hover:bg-cream-300 shadow-none border border-transparent",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-soft border border-transparent"
  };

  const sizes = {
    sm: "text-xs px-3 py-2 gap-1.5",
    md: "text-sm px-5 py-2.5 gap-2",
    lg: "text-base px-7 py-3.5 gap-2.5 rounded-3xl"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

