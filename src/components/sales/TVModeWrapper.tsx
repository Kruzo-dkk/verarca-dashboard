"use client";

import { useSalesContext } from "./SalesProvider";
import { TargetProgress } from "./TargetProgress";
import { PipelineBoard } from "./PipelineBoard";
import { ActivityFeed } from "./ActivityFeed";
import { Leaderboard } from "./Leaderboard";
import { RecentOutcomes } from "./RecentOutcomes";

const SCREENS = ["Targets", "Pipeline", "Activity", "Leaderboard"];

export function TVModeWrapper() {
  const { rotateMode, currentScreen, setCurrentScreen } = useSalesContext();

  return (
    <div className="tv-mode min-h-screen bg-gray-950 text-white p-6">
      {/* Progress bar for rotate mode */}
      {rotateMode && (
        <div className="flex justify-center gap-2 mb-6">
          {SCREENS.map((name, i) => (
            <button
              key={name}
              onClick={() => setCurrentScreen(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                i === currentScreen
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/40"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="absolute top-4 right-6 flex items-center gap-2 text-white/30 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </div>

      {rotateMode ? (
        // Rotating single screen
        <div className="max-w-6xl mx-auto">
          {currentScreen === 0 && <TargetProgress />}
          {currentScreen === 1 && <PipelineBoard />}
          {currentScreen === 2 && <ActivityFeed />}
          {currentScreen === 3 && <Leaderboard />}
        </div>
      ) : (
        // Single dense view
        <div className="max-w-7xl mx-auto space-y-6">
          <TargetProgress />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ActivityFeed />
            <Leaderboard />
          </div>
          <RecentOutcomes />
        </div>
      )}
    </div>
  );
}
