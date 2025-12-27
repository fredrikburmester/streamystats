"use client";

import { useEffect, useState } from "react";

export const usePersistantState = <T,>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] => {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const storedValue =
        typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (storedValue) {
        try {
          setState(JSON.parse(storedValue));
        } catch (e) {
          console.error(`Failed to parse stored value for key "${key}":`, e);
        }
      }
    } catch {
      // localStorage can throw (e.g. blocked storage / private mode)
    }
    setLoading(false);
  }, [key]);

  useEffect(() => {
    if (!loading) {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(state));
        }
      } catch {
        // localStorage can throw (e.g. blocked storage / quota exceeded)
      }
    }
  }, [key, state, loading]);

  return [state, setState, loading];
};
