"use client";

import { capabilities } from "@/data/facilities";
import type { MapState } from "@/types/healthcare";

type TopBarProps = {
  state: MapState;
  isDarkMode: boolean;
  states: string[];
  districts: string[];
  onCapabilityChange: (capability: MapState["capability"]) => void;
  onLocationChange: (key: keyof MapState["location"], value: string) => void;
  onTrustChange: (trust: number) => void;
  onAvailabilityChange: (key: keyof MapState["availability"], value: boolean) => void;
  onThemeToggle: () => void;
};

export const TopBar = ({
  state,
  isDarkMode,
  states,
  districts,
  onCapabilityChange,
  onLocationChange,
  onTrustChange,
  onAvailabilityChange,
  onThemeToggle,
}: TopBarProps) => {
  const panelClassName = isDarkMode
    ? "rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 shadow-lg backdrop-blur-md"
    : "rounded-xl border border-slate-200/80 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md";

  const selectClassName = isDarkMode
    ? "h-8 w-full rounded-md border border-white/20 bg-slate-800/90 px-2 text-xs text-slate-100"
    : "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800";

  const labelClassName = isDarkMode
    ? "flex w-full min-w-[150px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-300"
    : "flex w-full min-w-[150px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-600";

  return (
    <div className="absolute inset-x-0 top-0 z-[1000] px-4 pt-2">
      <section className={panelClassName}>
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] items-end gap-2">
          <label className={labelClassName}>
            Capability
            <select
              aria-label="Select capability layer"
              className={selectClassName}
              value={state.capability}
              onChange={(event) =>
                onCapabilityChange(event.target.value as MapState["capability"])
              }
            >
              {capabilities.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            State
            <select
              aria-label="Select state"
              className={selectClassName}
              value={state.location.state}
              onChange={(event) => onLocationChange("state", event.target.value)}
            >
              {states.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            District
            <select
              aria-label="Select district"
              className={selectClassName}
              value={state.location.district}
              onChange={(event) => onLocationChange("district", event.target.value)}
            >
              {districts.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className={labelClassName}>
            Schedule
            <label
              className={
                isDarkMode
                    ? "flex h-8 w-full items-center gap-2 rounded-md border border-white/15 bg-slate-800/90 px-2 text-xs normal-case tracking-normal text-slate-100"
                    : "flex h-8 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs normal-case tracking-normal text-slate-800"
              }
            >
              <input
                aria-label="Show facilities open 24/7"
                type="checkbox"
                checked={state.availability.open247}
                onChange={(event) =>
                  onAvailabilityChange("open247", event.target.checked)
                }
              />
              24/7 only
            </label>
          </div>

          <label className={labelClassName}>
            Trust {state.trustMin}%
            <input
              aria-label="Set trust threshold"
              className="h-8 w-full accent-cyan-500"
              type="range"
              min={0}
              max={100}
              step={10}
              value={state.trustMin}
              onChange={(event) => onTrustChange(Number(event.target.value))}
            />
          </label>

          <button
            aria-label="Toggle dark mode"
            className={
              isDarkMode
                ? "h-8 w-full rounded-md border border-white/20 bg-slate-800 px-2 text-xs text-white hover:bg-slate-700"
                : "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 hover:bg-slate-100"
            }
            onClick={onThemeToggle}
            type="button"
          >
            {isDarkMode ? "Dark" : "Light"}
          </button>
        </div>
      </section>
    </div>
  );
};
