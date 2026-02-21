export function TimelinePlanningSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-8 w-48 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-2 animate-pulse" />
              <div className="h-4 w-64 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
            </div>

            {/* View Mode Buttons Skeleton */}
            <div className="inline-flex items-center bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="w-20 h-9 bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse" />
              <div className="w-20 h-9 bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse" />
              <div className="w-20 h-9 bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse" />
            </div>
          </div>

          {/* Navigation Bar Skeleton */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse" />
            <div className="flex-1 flex items-center justify-center gap-4">
              <div className="h-6 w-48 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              <div className="h-8 w-24 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg animate-pulse" />
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse" />
          </div>

          {/* Seller Filter Skeleton */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg animate-pulse" />
              <div className="h-5 w-32 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Grid Skeleton */}
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header Row */}
              <div className="grid grid-cols-8 border-b border-slate-200">
                {/* Seller Column Header */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-r-2 border-slate-300 px-3 py-3">
                  <div className="h-4 w-16 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
                </div>
                {/* Date Columns Headers */}
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 px-2 py-2 text-center"
                  >
                    <div className="h-4 w-12 bg-gradient-to-r from-slate-200 to-slate-300 rounded mx-auto animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                    <div className="h-2 w-16 bg-gradient-to-r from-slate-100 to-slate-200 rounded mx-auto mt-1 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                  </div>
                ))}
              </div>

              {/* Seller Rows */}
              {Array.from({ length: 3 }).map((_, sellerIdx) => (
                <div key={sellerIdx} className="grid grid-cols-8">
                  {/* Seller Name Cell */}
                  <div className="bg-white border-r-2 border-t border-slate-300 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-200 to-blue-300 rounded-full animate-pulse flex-shrink-0" />
                      <div className="h-4 w-20 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
                    </div>
                  </div>

                  {/* Date Cells */}
                  {Array.from({ length: 7 }).map((_, dateIdx) => (
                    <div
                      key={dateIdx}
                      className="border-r border-t border-slate-200 p-1.5 min-h-[100px] bg-white"
                    >
                      {/* Random items in some cells */}
                      {(sellerIdx + dateIdx) % 3 === 0 && (
                        <div className="space-y-1.5">
                          <TimelineItemSkeleton delay={(sellerIdx * 7 + dateIdx) * 50} />
                          {(sellerIdx + dateIdx) % 5 === 0 && (
                            <TimelineItemSkeleton delay={(sellerIdx * 7 + dateIdx) * 50 + 100} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend Skeleton */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-blue-200 to-blue-300 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-purple-200 to-purple-300 rounded animate-pulse" />
                <div className="h-3 w-12 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimelineItemSkeletonProps {
  delay?: number;
}

function TimelineItemSkeleton({ delay = 0 }: TimelineItemSkeletonProps) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-1.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="space-y-1">
        {/* Image */}
        <div className="relative w-full h-16 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 rounded animate-pulse">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Icon + Price */}
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 bg-gradient-to-r from-blue-100 to-blue-200 rounded animate-pulse" />
          <div className="h-3 w-12 bg-gradient-to-r from-emerald-200 to-emerald-300 rounded animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <div className="h-2.5 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-full animate-pulse" />
          <div className="h-2.5 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-3/4 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
