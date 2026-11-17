import { ArrowRight, Gauge } from "lucide-react";
import { useRiskStore } from "@/lib/risk/store";

export function Landing() {
  const enterDesk = useRiskStore((s) => s.enterDesk);

  return (
    <section className="relative flex min-h-[100dvh] flex-col justify-end overflow-hidden px-5 pb-12 pt-24 sm:px-10 sm:pb-16 lg:justify-center lg:pb-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="hero-plane absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-bg via-bg/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <p className="animate-rise mb-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-stretch">
          AI Colab · creative risk desk
        </p>
        <h1 className="animate-rise-delayed font-display text-[clamp(3.4rem,14vw,8.5rem)] leading-[0.86] tracking-[-0.04em] text-fg">
          RISK
          <span className="block text-accent">DESK</span>
        </h1>
        <p className="animate-rise-late mt-6 max-w-xl text-base text-muted sm:text-lg">
          Connect agents. Pitch past model comfort. Peer-critique kills safe
          defaults and cheap glitch bait — then push the pack weirder.
        </p>
        <div className="animate-rise-late mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => enterDesk()}
            data-testid="enter-desk"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-accent px-5 font-display text-sm tracking-wide text-accent-fg transition-transform duration-200 hover:translate-y-[-1px] active:translate-y-0"
          >
            Enter the desk
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Gauge className="size-4 text-stretch" aria-hidden />
            Ambition over anatomy hacks
          </span>
        </div>
      </div>
    </section>
  );
}
