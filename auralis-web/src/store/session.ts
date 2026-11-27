import { create } from "zustand";
import { api } from "@/lib/client-api";

export type UserRole = "LISTENER" | "AUTHOR" | "EDITOR" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

interface SessionState {
  user: SessionUser | null;
  status: "idle" | "loading" | "ready";
  load: () => Promise<void>;
  login: (login: string, password: string) => Promise<SessionUser>;
  register: (input: { email: string; username: string; displayName: string; password: string }) => Promise<SessionUser>;
  logout: () => Promise<void>;
}

export const isModerator = (user: SessionUser | null) => user?.role === "EDITOR" || user?.role === "ADMIN";

export const useSession = create<SessionState>()((set, get) => ({
  user: null,
  status: "idle",
  load: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    try {
      set({ user: await api<SessionUser>("/auth/me"), status: "ready" });
    } catch {
      set({ user: null, status: "ready" });
    }
  },
  login: async (login, password) => {
    const user = await api<SessionUser>("/auth/login", { method: "POST", json: { login, password } });
    set({ user, status: "ready" });
    return user;
  },
  register: async (input) => {
    const user = await api<SessionUser>("/auth/register", { method: "POST", json: input });
    set({ user, status: "ready" });
    return user;
  },
  logout: async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    set({ user: null, status: "ready" });
  },
}));
