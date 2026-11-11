import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioShell } from "@/components/studio/shell";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <StudioShell current="/login">
      <div className="mx-auto max-w-md">
        <p className="tape mb-3">Members only</p>
        <h1 className="font-display text-4xl leading-none">Sign in</h1>
        <p className="mt-2 mb-6 text-muted">Designs, the cart, and orders stay on your account.</p>
        {authEnabled ? (
          <>
            <div className="mb-4 flex gap-2">
              <button type="button" className={`chip ${mode === "up" ? "chip-on" : ""}`} onClick={() => setMode("up")}>
                Create account
              </button>
              <button type="button" className={`chip ${mode === "in" ? "chip-on" : ""}`} onClick={() => setMode("in")}>
                Sign in
              </button>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                const run =
                  mode === "up"
                    ? authClient.signUp.email({ email, password, name: name || email.split("@")[0] || "Designer", callbackURL: "/studio" })
                    : authClient.signIn.email({ email, password, callbackURL: "/studio" });
                void run
                  .then((result) => {
                    if (result.error) {
                      setError(result.error.message ?? "Could not sign in.");
                      return;
                    }
                    window.location.href = "/studio";
                  })
                  .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not sign in."))
                  .finally(() => setBusy(false));
              }}
            >
              {mode === "up" ? (
                <Input aria-label="Name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
              ) : null}
              <Input aria-label="Email" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Input aria-label="Password" type="password" placeholder="Password" value={password} minLength={8} onChange={(event) => setPassword(event.target.value)} required />
              {error ? <p className="text-sm text-pipe">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {mode === "up" ? "Create account" : "Sign in"}
              </Button>
            </form>
            <div className="mt-6 flex flex-col gap-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button key={provider.providerId} variant="ghost" onClick={() => void signIn(provider.providerId, { callbackURL: "/studio" })}>
                  Continue with {provider.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p>Sign-in is off.</p>
        )}
      </div>
    </StudioShell>
  );
}
