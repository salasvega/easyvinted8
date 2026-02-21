export function ToPublishPageSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-8 w-52 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-2 animate-pulse" />
            <div className="h-4 w-72 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
          </div>

          {/* Filter Buttons Skeleton */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 75}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Filter Slider Skeleton */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-56 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
            <div className="h-7 w-24 bg-gradient-to-r from-emerald-200 to-teal-300 rounded-full animate-pulse" />
          </div>

          {/* Slider */}
          <div className="h-2 bg-gray-200 rounded-lg mb-3 animate-pulse" />

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

      {/* Table Skeleton */}
      <div className="mt-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Table Header Skeleton */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-4 px-6 py-4">
              <div className="col-span-5">
                <div className="h-4 w-20 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
              <div className="col-span-2">
                <div className="h-4 w-16 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
              <div className="col-span-2">
                <div className="h-4 w-24 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
              <div className="col-span-1">
                <div className="h-4 w-12 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
              <div className="col-span-2 flex justify-end">
                <div className="h-4 w-16 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Table Rows Skeleton */}
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, index) => (
              <ToPublishTableRowSkeleton key={index} delay={index * 50} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToPublishTableRowSkeletonProps {
  delay?: number;
}

function ToPublishTableRowSkeleton({ delay = 0 }: ToPublishTableRowSkeletonProps) {
  return (
    <div
      className="grid grid-cols-12 gap-4 px-6 py-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Article Info */}
      <div className="col-span-5 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 animate-pulse shadow-sm">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 rounded-xl -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-gradient-to-r from-teal-200 to-teal-300 animate-pulse shadow-lg" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-1/2 animate-pulse" />
        </div>
      </div>

      {/* Status */}
      <div className="col-span-2 flex items-center">
        <div className="h-7 w-20 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-lg animate-pulse" />
      </div>

      {/* Schedule */}
      <div className="col-span-2 flex items-center gap-2">
        <div className="h-4 w-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
      </div>

      {/* Price */}
      <div className="col-span-1 flex items-center">
        <div className="h-4 w-12 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
      </div>

      {/* Action Button */}
      <div className="col-span-2 flex items-center justify-end">
        <div className="h-9 w-28 bg-gradient-to-r from-emerald-200 to-teal-300 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
