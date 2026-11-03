// grey pulsing blocks shown while data loads
export const Skeleton = ({ h = 18, w = "100%", style }) => (
  <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden="true" />
);

export const SkeletonCards = ({ n = 3 }) => (
  <div className="grid3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: n }, (_, i) => (
      <div className="card" key={i}>
        <Skeleton h={14} w="50%" />
        <Skeleton h={28} w="70%" style={{ marginTop: 12 }} />
      </div>
    ))}
  </div>
);

export const SkeletonList = ({ n = 4 }) => (
  <div aria-busy="true" aria-label="Loading">
    {Array.from({ length: n }, (_, i) => (
      <div className="card" key={i}>
        <Skeleton h={16} w="40%" />
        <Skeleton h={12} w="80%" style={{ marginTop: 10 }} />
      </div>
    ))}
  </div>
);
