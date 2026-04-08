interface DressingPageSkeletonProps {
  viewMode?: 'grid' | 'table';
}

export function DressingPageSkeleton({ viewMode = 'grid' }: DressingPageSkeletonProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-3 pb-6 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="mb-4">
        <div className="h-8 w-48 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-1 animate-pulse" />
        <div className="h-4 w-80 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-4">
          {/* Total Card */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm px-4 py-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
          </div>

          {/* Brouillons Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-sm px-4 py-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-300 animate-pulse" />
              <div className="h-3 w-20 bg-slate-300 rounded animate-pulse" />
            </div>
            <div className="h-8 w-10 bg-gradient-to-r from-slate-300 to-slate-400 rounded animate-pulse" />
          </div>

          {/* Prêt Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm px-4 py-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-300 animate-pulse" />
              <div className="h-3 w-10 bg-blue-300 rounded animate-pulse" />
            </div>
            <div className="h-8 w-10 bg-gradient-to-r from-blue-300 to-blue-400 rounded animate-pulse" />
          </div>

          {/* Planifié Card */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm px-4 py-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-300 animate-pulse" />
              <div className="h-3 w-14 bg-orange-300 rounded animate-pulse" />
            </div>
            <div className="h-8 w-10 bg-gradient-to-r from-orange-300 to-orange-400 rounded animate-pulse" />
          </div>

          {/* Publié Card */}
          <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl shadow-sm px-4 py-4 border border-violet-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-300 animate-pulse" />
              <div className="h-3 w-12 bg-violet-300 rounded animate-pulse" />
            </div>
            <div className="h-8 w-10 bg-gradient-to-r from-violet-300 to-violet-400 rounded animate-pulse" />
          </div>

          {/* Vendus Card */}
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm px-4 py-4 border border-teal-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal-300 animate-pulse" />
              <div className="h-3 w-16 bg-teal-300 rounded animate-pulse" />
            </div>
            <div className="h-8 w-10 bg-gradient-to-r from-teal-300 to-teal-400 rounded animate-pulse" />
          </div>

          {/* Bénéfices Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-sm px-4 py-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-300 animate-pulse" />
              <div className="h-3 w-16 bg-emerald-300 rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-gradient-to-r from-emerald-300 to-emerald-400 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Filters Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border mb-4">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <div className="h-10 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse" />
              </div>
              <div className="h-9 w-32 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-20 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-32 bg-gradient-to-r from-blue-200 to-blue-300 rounded-lg animate-pulse" />
              <div className="h-10 w-28 bg-gradient-to-r from-violet-200 to-violet-300 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} delay={index * 50} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3">
                    <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                  </th>
                  <th className="px-4 py-3">
                    <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  </th>
                  <th className="px-4 py-3">
                    <div className="h-3 w-12 bg-slate-200 rounded animate-pulse" />
                  </th>
                  <th className="px-4 py-3">
                    <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  </th>
                  <th className="px-4 py-3">
                    <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                  </th>
                  <th className="px-4 py-3">
                    <div className="h-3 w-12 bg-slate-200 rounded animate-pulse mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonRow key={index} delay={index * 50} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface SkeletonCardProps {
  delay?: number;
}

function SkeletonCard({ delay = 0 }: SkeletonCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Image Skeleton */}
      <div className="relative aspect-square bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 animate-pulse">
        {/* Type badge skeleton */}
        <div className="absolute top-3 left-3">
          <div className="h-6 w-16 bg-slate-300 rounded-lg" />
        </div>

        {/* Count badge skeleton (for lots) */}
        <div className="absolute top-3 right-3">
          <div className="h-6 w-20 bg-slate-800/40 rounded-full backdrop-blur-sm" />
        </div>

        {/* Status badge skeleton */}
        <div className="absolute bottom-3 left-3">
          <div className="h-7 w-24 bg-slate-300/90 rounded-lg backdrop-blur-sm" />
        </div>

        {/* Subtle shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title & Brand */}
        <div className="space-y-2">
          <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-full animate-pulse" />
          <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-3/4 animate-pulse" />
          <div className="h-2.5 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-1/2 animate-pulse" />
        </div>

        {/* Price & Date */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="h-7 w-20 bg-gradient-to-r from-emerald-200 to-emerald-300 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded animate-pulse" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-2.5 w-12 bg-gradient-to-r from-slate-100 to-slate-200 rounded ml-auto animate-pulse" />
            <div className="h-3 w-16 bg-gradient-to-r from-slate-100 to-slate-200 rounded ml-auto animate-pulse" />
          </div>
        </div>

        {/* Seller */}
        <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-2/3 animate-pulse" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <div className="flex-1 h-8 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse" />
          <div className="flex-1 h-8 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

interface SkeletonRowProps {
  delay?: number;
}

function SkeletonRow({ delay = 0 }: SkeletonRowProps) {
  return (
    <tr
      className="hover:bg-slate-50/50 transition-colors"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Article/Lot */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3.5 bg-gradient-to-r from-slate-200 to-slate-300 rounded w-32 animate-pulse" />
            <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-24 animate-pulse" />
          </div>
        </div>
      </td>

      {/* Details */}
      <td className="px-4 py-4">
        <div className="space-y-2">
          <div className="h-5 bg-gradient-to-r from-emerald-200 to-emerald-300 rounded w-16 animate-pulse" />
          <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-12 animate-pulse" />
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-4">
        <div className="h-6 w-16 bg-gradient-to-r from-blue-200 to-blue-300 rounded-lg animate-pulse" />
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <div className="h-6 w-20 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg animate-pulse" />
      </td>

      {/* Seller */}
      <td className="px-4 py-4">
        <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-20 animate-pulse" />
      </td>

      {/* Season */}
      <td className="px-4 py-4">
        <div className="flex justify-center">
          <div className="w-6 h-6 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg animate-pulse" />
        </div>
      </td>
    </tr>
  );
}
