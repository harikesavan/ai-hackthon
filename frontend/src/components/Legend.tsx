"use client";

type LegendProps = {
  isDarkMode: boolean;
};

export const Legend = ({ isDarkMode }: LegendProps) => {
  return (
    <section
      className={
        isDarkMode
          ? "absolute right-4 top-[146px] z-[1000] rounded-lg border border-white/15 bg-slate-900/70 p-2 text-[11px] shadow-md backdrop-blur-sm"
          : "absolute right-4 top-[146px] z-[1000] rounded-lg border border-slate-200 bg-white/90 p-2 text-[11px] shadow-md backdrop-blur-sm"
      }
    >
      <div
        className={
          isDarkMode ? "flex items-center gap-3 text-slate-200" : "flex items-center gap-3 text-slate-700"
        }
      >
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          Full
        </p>
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
          Partial
        </p>
        <p className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Gap
        </p>
      </div>
    </section>
  );
};
