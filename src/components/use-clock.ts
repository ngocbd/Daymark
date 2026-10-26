import { useEffect, useState } from "react";
import { useHydrated } from "@tanstack/react-router";

export function useClock(): Date | null {
  const ready = useHydrated();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return ready ? new Date() : null;
}
