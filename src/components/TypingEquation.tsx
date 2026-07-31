"use client";

import { useEffect, useState } from "react";

const LINES = [
  "income − expenses = buffer",
  "₹98,600 − ₹44,160 = ₹54,440",
  "status → SAFE",
];

export function TypingEquation() {
  const [lineIndex, setLineIndex] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold" | "erase">("typing");

  const current = LINES[lineIndex];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (chars < current.length) {
        timer = setTimeout(() => setChars((c) => c + 1), 42);
      } else {
        timer = setTimeout(() => setPhase("hold"), 1600);
      }
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("erase"), 400);
    } else if (chars > 0) {
      timer = setTimeout(() => setChars((c) => c - 1), 22);
    } else {
      setLineIndex((i) => (i + 1) % LINES.length);
      setPhase("typing");
    }

    return () => clearTimeout(timer);
  }, [chars, phase, current.length]);

  return (
    <p className="typing-caret font-mono text-sm text-mint md:text-base">
      {current.slice(0, chars)}
    </p>
  );
}
