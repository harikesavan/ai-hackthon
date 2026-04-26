"use client";

import type { MapViewMode } from "@/types/healthcare";

type LegendProps = {
  isDarkMode: boolean;
  view: MapViewMode;
};

const items = [
  { color: "bg-green-500", label: "Full", desc: "Verified capability" },
  { color: "bg-yellow-500", label: "Partial", desc: "Limited evidence" },
  { color: "bg-red-500", label: "Gap", desc: "Insufficient data" },
];

export const Legend = ({ isDarkMode, view }: LegendProps) => {
  if (view === "deserts") {
    return (
      <section
        className={
          isDarkMode
            ? "absolute right-4 top-24 z-[900] w-64 rounded-xl border border-white/10 bg-slate-900/70 p-3 shadow-lg backdrop-blur-xl"
            : "absolute right-4 top-24 z-[900] w-64 rounded-xl border border-slate-200/50 bg-white/70 p-3 shadow-lg backdrop-blur-xl"
        }
      >
        <p
          className={
            isDarkMode
              ? "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              : "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
          }
        >
          Hospital Access Desert
        </p>
        <div className="h-2.5 w-full rounded-full bg-[linear-gradient(90deg,_rgb(34_197_94)_0%,_rgb(22_163_74)_20%,_rgb(250_204_21)_55%,_rgb(245_158_11)_75%,_rgb(220_38_38)_100%)]" />
        <div
          className={
            isDarkMode
              ? "mt-1 flex items-center justify-between text-[11px] text-slate-300"
              : "mt-1 flex items-center justify-between text-[11px] text-slate-600"
          }
        >
          <span className="whitespace-nowrap">Nearby</span>
          <span className="whitespace-nowrap">Far away</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={
        isDarkMode
          ? "absolute right-4 top-24 z-[900] rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-3 shadow-lg"
          : "absolute right-4 top-24 z-[900] rounded-xl border border-slate-200/50 bg-white/70 backdrop-blur-xl p-3 shadow-lg"
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
                  ? "text-[11px] text-slate-300 whitespace-nowrap"
                  : "text-[11px] text-slate-600 whitespace-nowrap"
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
