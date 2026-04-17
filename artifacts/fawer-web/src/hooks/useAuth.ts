import { useState, useEffect, useCallback } from "react";
import { fetchMe, logout as logoutApi, type AuthUser } from "../lib/api";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success" || params.get("auth") === "error") {
      window.history.replaceState({}, "", "/");
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutApi();
    await refresh();
  }, [refresh]);

  return { user, loading, refresh, logout };
}
