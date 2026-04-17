import { useState, useEffect } from "react";

const START = Date.now();

export function useUptime() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - START), 1000);
    return () => clearInterval(id);
  }, []);

  const s = Math.floor(elapsed / 1000);
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
}
