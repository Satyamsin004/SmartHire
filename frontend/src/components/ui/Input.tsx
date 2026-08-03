import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-black text-[#15342A] dark:text-[#E6F7EF] tracking-tight">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-[#6B7280] dark:text-[#6EE7B7] pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-[#FAF7F2] dark:bg-[#091B15] text-[#15342A] dark:text-white rounded-2xl text-xs font-bold px-4 py-3 border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#0F6B4B] dark:focus:ring-[#6EE7B7] disabled:opacity-60 placeholder-[#6B7280]/60 ${
            leftIcon ? 'pl-10' : ''
          } ${rightIcon ? 'pr-10' : ''} ${
            error
              ? 'border-rose-400 focus:ring-rose-500'
              : 'border-[#E7E5E4] dark:border-[#0B543A] hover:border-[#0F6B4B]/50'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 text-[#6B7280] dark:text-[#6EE7B7]">
            {rightIcon}
          </div>
        )}
      </div>
      {error ? (
        <p className="text-[11px] font-bold text-rose-500">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#C7EFE0]">{helperText}</p>
      ) : null}
    </div>
  );
};
