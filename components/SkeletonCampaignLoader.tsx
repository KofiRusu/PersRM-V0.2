import React from 'react';
import { Skeleton } from './ui/skeleton';

type LoaderType = 'board' | 'calendar' | 'modal' | 'item';

interface SkeletonCampaignLoaderProps {
  type: LoaderType;
  count?: number;
}

interface SkeletonCountProps {
  count: number;
}

export function SkeletonCampaignLoader({ 
  type, 
  count = 5 
}: SkeletonCampaignLoaderProps): React.ReactElement {
  switch (type) {
    case 'board':
      return <SkeletonCampaignBoard count={count} />;
    case 'calendar':
      return <SkeletonCampaignCalendar />;
    case 'modal':
      return <SkeletonCampaignModal />;
    case 'item':
      return <SkeletonCampaignItem count={count} />;
    default:
      return <SkeletonCampaignBoard count={count} />;
  }
}

export function SkeletonCampaignBoard({ count }: SkeletonCountProps): React.ReactElement {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-2 p-3 border rounded-md">
            <Skeleton className="h-6 w-28" />
            <div className="space-y-3">
              {Array.from({ length: Math.ceil(count / 4) }).map((_, itemIndex) => (
                <div key={itemIndex} className="border rounded-md p-3 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <div className="flex gap-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCampaignCalendar(): React.ReactElement {
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      
      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-1">
        {/* Calendar header */}
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-8" />
        ))}
        
        {/* Calendar days */}
        {Array.from({ length: 35 }).map((_, index) => (
          <div key={`day-${index}`} className="h-24 border rounded overflow-hidden p-1">
            <div className="flex justify-between items-start">
              <Skeleton className="h-4 w-4" />
              {Math.random() > 0.7 && (
                <div className="space-y-1">
                  {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, eventIndex) => (
                    <Skeleton 
                      key={`event-${index}-${eventIndex}`} 
                      className="h-5 w-full rounded-sm" 
                      style={{ 
                        width: `${Math.floor(Math.random() * 40) + 60}%`,
                        opacity: Math.random() * 0.5 + 0.5
                      }} 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCampaignModal(): React.ReactElement {
  return (
    <div className="space-y-4 p-6 max-w-md mx-auto border rounded-lg">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-20 w-full" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCampaignItem({ count }: SkeletonCountProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index} 
          className="border rounded-md p-3 space-y-2"
          style={{ opacity: 1 - (index * 0.1) }}
        >
          <div className="flex justify-between">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
          
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
          
          <Skeleton className="h-4 w-1/2" />
          
          <div className="flex gap-1 pt-1">
            {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, tagIndex) => (
              <Skeleton 
                key={`tag-${index}-${tagIndex}`} 
                className="h-5 w-12 rounded-full" 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 