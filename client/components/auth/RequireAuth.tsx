"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../lib/types";

// Client-side route guard (§9.3). Redirects unauthenticated users to /login and
// forbidden roles back to the landing page. Server middleware is the real gate;
// this just keeps the UI honest.
export function RequireAuth({
  roles,
  children,
}: {
  roles?: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = user && (!roles || roles.includes(user.role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (roles && !roles.includes(user.role)) {
      router.replace("/");
    }
  }, [loading, user, roles, router, pathname]);

  if (loading || !allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-arena text-muted">
        טוען…
      </div>
    );
  }
  return <>{children}</>;
}

/** Manager surfaces — Admin or Organizer. */
export function RequireManager({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["Admin", "Organizer"]}>{children}</RequireAuth>;
}
