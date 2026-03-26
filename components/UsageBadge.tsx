interface UsageBadgeProps {
  used: number;
  limit: number;
  plan: string;
}

export function UsageBadge({ used, limit, plan }: UsageBadgeProps) {
  const pct = Math.min((used / limit) * 100, 100);
  const isNear = pct >= 80;
  const isOver = used >= limit;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500 capitalize">{plan} plan</span>
        <span className={`text-sm font-mono font-medium ${isOver ? 'text-red-400' : isNear ? 'text-amber-400' : 'text-slate-300'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : isNear ? 'bg-amber-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-slate-600 mt-1">Clips this month</div>
    </div>
  );
}
