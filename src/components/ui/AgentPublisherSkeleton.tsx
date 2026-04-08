export function AgentPublisherSkeleton() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="h-8 w-64 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-2 animate-pulse" />
        <div className="h-4 w-80 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Mobile Tabs Skeleton */}
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b flex">
          <div className="flex-1 py-3 bg-gradient-to-r from-slate-200 to-slate-300 animate-pulse" />
          <div className="flex-1 py-3 bg-gradient-to-r from-slate-100 to-slate-200 animate-pulse" />
        </div>

        {/* Sidebar Skeleton */}
        <aside className="w-full lg:w-80 bg-white lg:border-r flex flex-col">
          {/* Sidebar Header */}
          <div className="p-3 lg:p-4 border-b bg-slate-50">
            <div className="h-5 w-32 bg-gradient-to-r from-slate-200 to-slate-300 rounded mb-2 animate-pulse" />
            <div className="h-4 w-48 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
          </div>

          {/* Items List Skeleton */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-180px)] lg:max-h-none">
            <div className="p-3 lg:p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <AgentItemSkeleton key={i} delay={i * 60} />
              ))}
            </div>
          </div>

          {/* Refresh Button Skeleton */}
          <div className="p-3 lg:p-4 border-t bg-slate-50">
            <div className="w-full h-10 lg:h-12 bg-gradient-to-r from-slate-200 to-slate-300 rounded-xl animate-pulse" />
          </div>
        </aside>

        {/* Main Content Skeleton */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-4 lg:space-y-6">
            {/* Workflow Steps Skeleton */}
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border">
              <div className="h-6 w-48 bg-gradient-to-r from-slate-200 to-slate-300 rounded mb-4 animate-pulse" />

              {/* Steps Progress Bar */}
              <div className="flex items-center justify-between mb-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex items-center">
                    <div className="w-7 h-7 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 animate-pulse" />
                    {idx < 4 && (
                      <div className="w-4 lg:w-8 h-1 mx-0.5 lg:mx-1 bg-slate-200 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Labels */}
              <div className="flex justify-between px-0.5 lg:px-1">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex-1 text-center">
                    <div className="h-3 w-12 mx-auto bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Panel Skeleton */}
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border space-y-3 lg:space-y-4">
              {/* Start Run Button */}
              <div className="w-full h-16 lg:h-20 bg-gradient-to-r from-slate-200 to-slate-300 rounded-xl animate-pulse" />

              {/* Copy Button */}
              <div className="w-full h-16 lg:h-20 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-xl animate-pulse" />

              {/* URL Input */}
              <div className="p-3 lg:p-4 rounded-xl border-2 border-slate-200">
                <div className="h-4 w-48 bg-gradient-to-r from-slate-200 to-slate-300 rounded mb-2 animate-pulse" />
                <div className="h-12 lg:h-14 bg-gradient-to-r from-slate-100 to-slate-200 rounded-xl animate-pulse" />
              </div>

              {/* Status Buttons */}
              <div className="p-3 lg:p-4 rounded-xl border-2 border-slate-200">
                <div className="h-4 w-40 bg-gradient-to-r from-slate-200 to-slate-300 rounded mb-3 animate-pulse" />
                <div className="grid grid-cols-2 gap-3 lg:gap-4">
                  <div className="h-16 lg:h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-xl animate-pulse" />
                  <div className="h-16 lg:h-20 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl animate-pulse" />
                </div>
              </div>

              {/* Next Button */}
              <div className="w-full h-12 lg:h-14 bg-gradient-to-r from-slate-100 to-slate-200 rounded-xl animate-pulse" />
            </div>

            {/* Error Panel Skeleton */}
            <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border">
              <div className="flex items-center gap-2 mb-3 lg:mb-4">
                <div className="w-5 h-5 bg-gradient-to-r from-red-200 to-red-300 rounded-full animate-pulse" />
                <div className="h-6 w-32 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
              <div className="w-full h-12 lg:h-14 bg-gradient-to-r from-red-100 to-red-200 rounded-xl animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

interface AgentItemSkeletonProps {
  delay?: number;
}

function AgentItemSkeleton({ delay = 0 }: AgentItemSkeletonProps) {
  return (
    <div
      className="w-full p-3 lg:p-4 border-b bg-white rounded-lg"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Number Badge */}
        <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 animate-pulse flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-3/4 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
            <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-24 animate-pulse" />
          </div>
        </div>

        {/* Shimmer Effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  );
}
