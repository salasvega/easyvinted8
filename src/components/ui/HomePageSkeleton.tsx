export function HomePageSkeleton() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Navigation Skeleton */}
      <nav className="w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-lg animate-pulse" />
              <div className="h-6 w-32 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
            </div>
            <div className="w-24 h-8 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
          </div>
        </div>
      </nav>

      {/* Hero Section Skeleton */}
      <section className="relative overflow-hidden pt-20 pb-32 px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-100/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-100/40 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="h-16 bg-gradient-to-r from-slate-200 to-slate-300 rounded-xl mb-6 mx-auto max-w-3xl animate-pulse" />
            <div className="h-8 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg mb-3 mx-auto max-w-2xl animate-pulse" />
            <div className="h-8 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg mb-10 mx-auto max-w-xl animate-pulse" />

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <div className="h-14 w-48 bg-gradient-to-r from-emerald-200 to-emerald-300 rounded-full animate-pulse" />
              <div className="h-14 w-52 bg-gradient-to-r from-blue-200 to-blue-300 rounded-full animate-pulse" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="h-5 w-48 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
              <div className="h-5 w-44 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
              <div className="h-5 w-32 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section Skeleton */}
      <section className="py-16 px-6 lg:px-8 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="text-center">
                <div className="h-12 w-24 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-2 mx-auto animate-pulse" />
                <div className="h-4 w-32 bg-gradient-to-r from-slate-100 to-slate-200 rounded mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section Skeleton */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="h-12 bg-gradient-to-r from-slate-200 to-slate-300 rounded-xl mb-4 mx-auto max-w-md animate-pulse" />
            <div className="h-6 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg mx-auto max-w-xl animate-pulse" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 border border-slate-200">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl mb-5 animate-pulse" />
                <div className="h-6 bg-gradient-to-r from-slate-200 to-slate-300 rounded-lg mb-3 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-4/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Skeleton */}
      <section className="py-24 px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="h-12 bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl mb-4 mx-auto max-w-md animate-pulse" />
            <div className="h-6 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg mx-auto max-w-sm animate-pulse" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                <div className="h-20 w-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg mb-6 animate-pulse" />
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-300 to-emerald-400 rounded-2xl mb-6 animate-pulse" />
                <div className="h-7 w-48 bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg mb-3 animate-pulse" />
                <div className="space-y-2 w-full">
                  <div className="h-4 bg-gradient-to-r from-slate-600 to-slate-700 rounded animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-slate-600 to-slate-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Skeleton */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="h-12 bg-gradient-to-r from-slate-200 to-slate-300 rounded-xl mb-4 mx-auto max-w-md animate-pulse" />
            <div className="h-6 bg-gradient-to-r from-slate-100 to-slate-200 rounded-lg mx-auto max-w-lg animate-pulse" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 border border-slate-200">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-5 h-5 bg-gradient-to-r from-amber-200 to-amber-300 rounded animate-pulse" />
                  ))}
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                  <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-3/4 animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-full animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gradient-to-r from-slate-200 to-slate-300 rounded mb-2 animate-pulse" />
                    <div className="h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-2/3 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section Skeleton */}
      <section className="py-24 px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="h-12 bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl mb-6 mx-auto max-w-2xl animate-pulse" />
          <div className="h-6 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg mb-10 mx-auto max-w-xl animate-pulse" />
          <div className="h-16 w-56 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full mx-auto mb-6 animate-pulse" />
          <div className="h-4 bg-gradient-to-r from-slate-600 to-slate-700 rounded mx-auto max-w-md animate-pulse" />
        </div>
      </section>

      {/* Footer Skeleton */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-200 to-emerald-300 rounded-lg animate-pulse" />
                <div className="h-6 w-32 bg-gradient-to-r from-slate-200 to-slate-300 rounded animate-pulse" />
              </div>
              <div className="space-y-2 max-w-md">
                <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                <div className="h-4 bg-gradient-to-r from-slate-100 to-slate-200 rounded w-3/4 animate-pulse" />
              </div>
            </div>

            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx}>
                <div className="h-5 w-24 bg-gradient-to-r from-slate-200 to-slate-300 rounded mb-4 animate-pulse" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-4 w-32 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="h-4 w-64 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
            <div className="flex items-center gap-6">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-4 w-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
