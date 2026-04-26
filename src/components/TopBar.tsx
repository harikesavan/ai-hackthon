"use client";

import { capabilities, defaultMapState } from "@/data/facilities";
import type { MapState, MapViewMode } from "@/types/healthcare";

type TopBarProps = {
  state: MapState;
  view: MapViewMode;
  isDarkMode: boolean;
  states: string[];
  districts: string[];
  facilityCount: number;
  onViewChange: (view: MapViewMode) => void;
  onCapabilityChange: (capability: MapState["capability"]) => void;
  onLocationChange: (key: keyof MapState["location"], value: string) => void;
  onTrustChange: (trust: number) => void;
  onAvailabilityChange: (key: keyof MapState["availability"], value: boolean) => void;
  onResetFilters: () => void;
  onThemeToggle: () => void;
};

export const TopBar = ({
  state,
  view,
  isDarkMode,
  states,
  districts,
  facilityCount,
  onViewChange,
  onCapabilityChange,
  onLocationChange,
  onTrustChange,
  onAvailabilityChange,
  onResetFilters,
  onThemeToggle,
}: TopBarProps) => {
  const panelClassName = isDarkMode
    ? "rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-2 shadow-lg backdrop-blur-md"
    : "rounded-2xl border border-slate-200/50 bg-white/85 px-4 py-2 shadow-lg backdrop-blur-md";

  const selectClassName = isDarkMode
    ? "h-7 cursor-pointer rounded-lg border border-white/10 bg-slate-800/60 px-2 text-xs text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
    : "h-7 cursor-pointer rounded-lg border border-slate-200 bg-white/80 px-2 text-xs text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40";

  const labelClassName = isDarkMode
    ? "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400"
    : "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-500";

  const groupClassName = "flex min-w-[120px] flex-col gap-1";

  const checkboxClassName = isDarkMode
    ? "flex h-7 cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-slate-800/60 px-2 text-xs text-slate-100"
    : "flex h-7 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-2 text-xs text-slate-800";

  const badgeClassName = isDarkMode
    ? "rounded-full border border-cyan-500/20 bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-300"
    : "rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700";

  const resetButtonClassName = isDarkMode
    ? "cursor-pointer whitespace-nowrap rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-all duration-200 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
    : "cursor-pointer whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-all duration-200 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50";

  const themeToggleClassName = isDarkMode
    ? "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-300 transition-colors duration-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
    : "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-200 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50";

  const showResetButton =
    state.location.state !== defaultMapState.location.state ||
    state.location.district !== defaultMapState.location.district ||
    state.trustMin !== defaultMapState.trustMin ||
    state.availability.open247 !== defaultMapState.availability.open247;

  const brandToneClassName = isDarkMode ? "text-cyan-300" : "text-cyan-600";

  return (
    <div className="absolute inset-x-0 top-0 z-[1000] px-4 pt-2">
      <section className={panelClassName}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <span className={brandToneClassName}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M8 1v14M1 8h14" />
              </svg>
            </span>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-sm font-bold text-transparent">
              Agentic Health Map
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className={groupClassName}>
              <span className={labelClassName}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h12M2 8h12M2 13h12" />
                </svg>
                View
              </span>
              <select
                aria-label="Select map view"
                className={selectClassName}
                value={view}
                onChange={(event) => onViewChange(event.target.value as MapViewMode)}
              >
                <option value="hospitals">Hospitals</option>
                <option value="deserts">Deserts</option>
              </select>
            </label>

            <label className={groupClassName}>
              <span className={labelClassName}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" />
                </svg>
                Capability
              </span>
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

            <label className={groupClassName}>
              <span className={labelClassName}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" />
                  <circle cx="8" cy="6" r="1.5" />
                </svg>
                State
              </span>
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

            <label className={groupClassName}>
              <span className={labelClassName}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" />
                  <circle cx="8" cy="6" r="1.5" />
                </svg>
                District
              </span>
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

            <div className={groupClassName}>
              <span className={labelClassName}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4v4l3 2" />
                </svg>
                Schedule
              </span>
              <label className={checkboxClassName}>
                <input
                  aria-label="Show facilities open 24/7"
                  type="checkbox"
                  checked={state.availability.open247}
                  onChange={(event) =>
                    onAvailabilityChange("open247", event.target.checked)
                  }
                />
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 4v4l3 2" />
                  </svg>
                  24/7 only
                </span>
              </label>
            </div>

            <label className="flex min-w-[140px] flex-col gap-1">
              <span className={labelClassName}>Trust ≥ {state.trustMin}%</span>
              <input
                aria-label="Set trust threshold"
                className="trust-slider h-7 w-full cursor-pointer accent-cyan-500"
                type="range"
                min={0}
                max={100}
                step={10}
                value={state.trustMin}
                onChange={(event) => onTrustChange(Number(event.target.value))}
              />
            </label>

            <div className={badgeClassName}>{facilityCount} facilities</div>

            {showResetButton ? (
              <button
                aria-label="Reset filters"
                className={resetButtonClassName}
                onClick={onResetFilters}
                type="button"
              >
                × Reset
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-end">
            <button
              aria-label="Toggle dark mode"
              className={themeToggleClassName}
              onClick={onThemeToggle}
              type="button"
            >
              {isDarkMode ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="10" cy="10" r="4" />
                  <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M17.3 13.3A8 8 0 016.7 2.7 8 8 0 1017.3 13.3z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
