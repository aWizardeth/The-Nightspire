// ─────────────────────────────────────────────────────────────────
//  BattleDashboard — overview of active and recent battles
// ─────────────────────────────────────────────────────────────────

// TODO: Fetch active battles from gym-server
// TODO: Show battle history from tracker API
// TODO: Launch-battle action (deep link or inline)

export default function BattleDashboard() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">⚔️ Battle Dashboard</h2>
      <p className="text-[var(--text-muted)] text-sm">
        Your battles will appear here once connected to the gym server.
      </p>

      {/* Placeholder cards */}
      <div className="grid gap-3">
        {['Active Battles', 'Recent Results', 'Quick Match'].map((title) => (
          <div
            key={title}
            className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--bg-tertiary)]"
          >
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
            <p className="text-xs text-[var(--text-muted)]">Coming soon…</p>
          </div>
        ))}
      </div>
    </div>
  );
}
