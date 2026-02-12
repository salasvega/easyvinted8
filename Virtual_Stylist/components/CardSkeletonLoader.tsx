export default function CardSkeletonLoader() {
  return (
    <div className="relative aspect-[3/4] bg-white rounded-xl border-2 border-dashed border-gray-200 overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-2 p-3 h-full">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex-shrink-0 h-full aspect-[3/4] rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden"
                style={{
                  animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  animationDelay: `${index * 0.15}s`
                }}
              >
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  style={{
                    animation: 'shimmer-sweep 2s ease-in-out infinite',
                    animationDelay: `${index * 0.15}s`
                  }}
                ></div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-gray-300/60 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 p-3 border-t border-gray-100 bg-gray-50/50 animate-pulse">
          <div className="h-2 bg-gray-200 rounded mx-auto" style={{ width: '60%' }}></div>
        </div>
      </div>

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        @keyframes shimmer-sweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
