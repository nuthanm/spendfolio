"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  duration?: number;
  prefix?: string;
  className?: string;
  format?: (n: number) => string;
};

export function AnimatedNumber({
  value,
  duration = 1400,
  prefix = "",
  className = "",
  format,
}: Props) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const text = format ? format(display) : display.toLocaleString("en-IN");

  return (
    <span className={`number-tick ${className}`}>
      {prefix}
      {text}
    </span>
  );
}
