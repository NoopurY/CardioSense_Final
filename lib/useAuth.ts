"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => {
        if (r.status === 401) {
          router.push("/auth/login");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data) setUser(data.data ?? data);
        setLoading(false);
      })
      .catch(() => {
        router.push("/auth/login");
      });
  }, [router]);

  return { user, loading };
}
