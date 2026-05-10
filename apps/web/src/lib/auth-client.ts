import { createAuthClient } from "better-auth/react";

const apiOrigin = (import.meta.env.VITE_AUTH_URL as string | undefined)
  ?? (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/v1\/?$/, "")
  ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: apiOrigin,
});

export const { signIn, signOut, useSession } = authClient;
export type Session = typeof authClient.$Infer.Session;
