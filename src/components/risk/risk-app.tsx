import { Atmosphere, DeskNav } from "@/components/risk/chrome";
import { Landing } from "@/components/risk/landing";
import { BriefPanel } from "@/components/risk/brief-panel";
import { RosterPanel } from "@/components/risk/roster";
import { BoardPanel } from "@/components/risk/board";
import { OvernightPanel } from "@/components/risk/overnight";
import { useRiskStore } from "@/lib/risk/store";

export function RiskApp() {
  const phase = useRiskStore((s) => s.phase);

  return (
    <div className="relative min-h-[100dvh] text-fg">
      <Atmosphere />
      <DeskNav />
      <main>
        {phase === "landing" ? <Landing /> : null}
        {phase === "brief" ? <BriefPanel /> : null}
        {phase === "roster" ? <RosterPanel /> : null}
        {phase === "board" ? <BoardPanel /> : null}
        {phase === "overnight" ? <OvernightPanel /> : null}
      </main>
    </div>
  );
}
