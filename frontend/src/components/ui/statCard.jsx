
function StatCard({ title, value, icon: Icon, description, color = "blue" }) {
  const colorStyles = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
    red: "bg-red-100 text-red-600",
    cyan: "bg-cyan-100 text-cyan-600",
    pink: "bg-pink-100 text-pink-600",
    yellow: "bg-yellow-100 text-yellow-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            colorStyles[color] || colorStyles.blue
          }`}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>

      <p className="mt-1.5 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default StatCard;

