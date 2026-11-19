import { Link } from "@tanstack/react-router";
import { copy } from "@/lib/copy";

/** The prompt in place of a paid call. Children replace the default sentence. */
export function SignInCall({ children }: { children?: string }) {
  return (
    <div className="border-2 border-ink bg-surface p-3 text-sm">
      <p>{children ?? copy.signInToDraw}</p>
      <Link to="/login" className="chip chip-on mt-3 inline-flex min-h-11 items-center">
        Sign in
      </Link>
    </div>
  );
}
