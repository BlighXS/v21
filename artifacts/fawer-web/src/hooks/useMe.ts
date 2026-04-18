import { useEffect, useState } from "react";

export interface MeData {
  authenticated: boolean;
  guest: boolean;
  discordId?: string;
  username?: string;
  globalName?: string | null;
  avatar?: string | null;
  isOwner?: boolean;
  guestMessagesLeft?: number;
  noSession?: boolean;
}

export function useMe() {
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: MeData) => setMe(data))
      .catch(() => setMe({ authenticated: false, guest: false }))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading };
}
