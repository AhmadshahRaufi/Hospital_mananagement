import { useEffect, useRef, useState } from "react";

// Animates a number from its previous value up (or down) to `value` over
// `duration` ms using requestAnimationFrame — used for the KPI cards so the
// dashboard feels alive on load/refresh instead of just snapping to a number.
// Falls back gracefully (renders 0 -> value) the first time it mounts.
export default function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = fromRef.current;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}
