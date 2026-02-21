export function ToPublishPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 bg-gradient-to-r from-emerald-200 to-emerald-300 rounded animate-pulse" />
          <div>
            <div className="h-8 w-52 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-2 animate-pulse" />
            <div className="h-4 w-72 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Filter Slider Skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-56 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
            <div className="h-6 w-20 bg-gradient-to-r from-teal-200 to-teal-300 rounded animate-pulse" />
          </div>

          {/* Slider */}
          <div className="h-2 bg-gray-200 rounded-lg mb-2 animate-pulse" />

          {/* Slider Labels */}
          <div className="flex justify-between text-xs">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-3 w-12 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Items Grid Skeleton */}
      <div className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ToPublishItemSkeleton key={index} delay={index * 50} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToPublishItemSkeletonProps {
  delay?: number;
}

function ToPublishItemSkeleton({ delay = 0 }: ToPublishItemSkeletonProps) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Photo Skeleton */}
      <div className="relative aspect-square bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 animate-pulse">
        {/* Type Badge Skeleton */}
        <div className="absolute top-2 left-2">
          <div className="h-6 w-16 bg-slate-300 rounded-lg" />
        </div>

        {/* Shimmer Effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Content Skeleton */}
      <div className="p-4">
        {/* Title Skeleton */}
        <div className="mb-2 space-y-2 min-h-[3rem]">
          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-full animate-pulse" />
          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-3/4 animate-pulse" />
        </div>

        {/* Status & Date Skeleton */}
        <div className="flex items-center justify-between mb-3">
          <div className="h-6 w-16 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
        </div>

        {/* Publish Button Skeleton */}
        <div className="h-10 w-full bg-gradient-to-r from-emerald-200 to-emerald-300 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
