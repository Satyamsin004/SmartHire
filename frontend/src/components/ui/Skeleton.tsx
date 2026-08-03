import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`animate-shimmer rounded-2xl bg-[#F4EFE6] dark:bg-[#15342A] ${className}`} />
  );
};
