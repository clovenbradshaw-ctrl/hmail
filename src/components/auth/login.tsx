import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginWithPassword, resolveHomeserver } from "@/lib/matrix";

function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const errcode = (err as { errcode?: string })?.errcode;
  if (errcode === "M_FORBIDDEN") return "Wrong username or password.";
  if (errcode === "M_USER_DEACTIVATED") return "This account is deactivated.";
  if (errcode === "M_LIMIT_EXCEEDED")
    return "Rate-limited by the homeserver. Wait a moment and try again.";
  if (/cors/i.test(msg) || /Failed to fetch/i.test(msg))
    return "Couldn't reach the homeserver. It may be offline, blocked by CORS, or the URL is wrong.";
  return msg || "Login failed.";
}

export function Login() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [homeserver, setHomeserver] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user types a full MXID like @alice:matrix.org, we don't ask for
  // the homeserver — we resolve it from the domain part.
  const userHasDomain = user.includes(":");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let baseUrl = homeserver.trim();
      if (!baseUrl) {
        if (!userHasDomain) {
          throw new Error(
            "Enter a full MXID (e.g. @alice:matrix.org) or fill in the homeserver URL.",
          );
        }
        baseUrl = await resolveHomeserver(user.trim());
      }
      // Normalize: ensure scheme.
      if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;
      await loginWithPassword(baseUrl, user.trim(), password);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background paper-grain">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-md border border-border/60 bg-background/80 p-8 shadow-sm"
      >
        <div className="mb-6 flex items-baseline gap-2">
          <span className="font-display text-4xl italic leading-none text-seal">
            h
          </span>
          <span className="font-display text-3xl font-medium leading-none">
            mail
          </span>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to any Matrix homeserver.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-foreground/80">
            Username or MXID
          </span>
          <Input
            autoFocus
            autoComplete="username"
            placeholder="@alice:matrix.org"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            disabled={busy}
            className="font-mono text-sm"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-foreground/80">
            Password
          </span>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>

        {!userHasDomain && (
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium text-foreground/80">
              Homeserver
            </span>
            <Input
              type="url"
              placeholder="https://matrix.org"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              disabled={busy}
              className="font-mono text-sm"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Or enter a full MXID above (e.g. <span className="font-mono">@alice:matrix.org</span>) and we'll resolve it.
            </span>
          </label>
        )}

        {error && (
          <div className="mb-4 rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <p className="mt-6 text-[10px] leading-relaxed text-muted-foreground">
          hmail talks to your homeserver directly from your browser. No traffic
          flows through any hmail server. If sign-in fails with a network
          error, your homeserver may need <span className="font-mono">CORS</span> configured for{" "}
          <span className="font-mono">{typeof window !== "undefined" ? window.location.origin : "this origin"}</span>.
        </p>
      </form>
    </div>
  );
}
