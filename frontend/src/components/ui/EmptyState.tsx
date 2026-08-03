import React from 'react';
import { EmptyStateIllustration } from '../illustrations/Illustrations';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There are no active records in the platform for this view.',
  icon = <EmptyStateIllustration className="w-24 h-24" />,
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <div className={`py-16 px-6 text-center bg-white dark:bg-[#15342A] rounded-3xl border border-[#E7E5E4] dark:border-[#0B543A] shadow-soft flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className="flex items-center justify-center mb-1">
        {icon}
      </div>
      <h4 className="text-base font-black text-[#15342A] dark:text-white tracking-tight">{title}</h4>
      <p className="text-xs text-[#6B7280] dark:text-[#C7EFE0] font-medium max-w-sm">{description}</p>
      {actionText && onAction && (
        <div className="pt-2">
          <Button onClick={onAction} variant="primary" size="sm">
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};
