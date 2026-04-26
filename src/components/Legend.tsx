"use client";

type LegendProps = { isDarkMode: boolean };

const items = [
  { color: "bg-green-500", label: "Full", desc: "Verified capability" },
  { color: "bg-yellow-500", label: "Partial", desc: "Limited evidence" },
  { color: "bg-red-500", label: "Gap", desc: "Insufficient data" },
];

export const Legend = ({ isDarkMode }: LegendProps) => {
  return (
    <section
      className={
        isDarkMode
          ? "absolute right-4 top-20 z-[1000] rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-3 shadow-lg"
          : "absolute right-4 top-20 z-[1000] rounded-xl border border-slate-200/50 bg-white/70 backdrop-blur-xl p-3 shadow-lg"
      }
    >
      <p
        className={
          isDarkMode
            ? "text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2"
            : "text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2"
        }
      >
        Trust Level
      </p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            <span
              className={
                isDarkMode
                  ? "text-[11px] text-slate-300"
                  : "text-[11px] text-slate-600"
              }
            >
              <span className="font-medium">{item.label}</span>
              <span className="opacity-60"> — {item.desc}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
