// ─────────────────────────────────────────────────────────────────
//  Leaderboard — APS rankings table
// ─────────────────────────────────────────────────────────────────

// TODO: Fetch rankings from tracker API
// TODO: Highlight current user's row
// TODO: Pagination or infinite scroll

export default function Leaderboard() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">🏆 Leaderboard</h2>
      <p className="text-[var(--text-muted)] text-sm">
        Top Arcane warriors ranked by APS score.
      </p>

      {/* Placeholder table */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--bg-tertiary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--bg-tertiary)] text-[var(--text-muted)]">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-right">APS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-[var(--text-muted)]">
                Loading rankings…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
