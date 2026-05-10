import { Github, Loader2, LogOut, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn, signOut, useSession } from "@/lib/auth-client";

function getCallbackURL(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return window.location.href;
}

export function AuthStatus() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  if (isPending) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking session
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm">
          <UserCircle2 className="h-4 w-4 text-primary" />
          <span className="max-w-32 truncate">{user.name ?? user.email ?? "Signed in"}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => void signIn.social({ provider: "github", callbackURL: getCallbackURL() })}
    >
      <Github className="h-4 w-4" />
      <span className="hidden sm:inline">Sign in</span>
    </Button>
  );
}
