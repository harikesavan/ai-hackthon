"use client";

import { defaultMapState } from "@/data/facilities";
import type { MapState, MapViewMode } from "@/types/healthcare";
import Image from "next/image";

type TopBarProps = {
  state: MapState;
  view: MapViewMode;
  isDarkMode: boolean;
  states: string[];
  districts: string[];
  facilityCount: number;
  onViewChange: (view: MapViewMode) => void;
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
  onLocationChange,
  onTrustChange,
  onAvailabilityChange,
  onResetFilters,
  onThemeToggle,
}: TopBarProps) => {
  const areHospitalControlsDisabled = view === "deserts";
  const isDistrictDisabled =
    areHospitalControlsDisabled ||
    state.location.state === defaultMapState.location.state;

  const panelClassName = isDarkMode
    ? "rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-2 shadow-lg backdrop-blur-md"
    : "rounded-2xl border border-slate-200/50 bg-white/85 px-4 py-2 shadow-lg backdrop-blur-md";

  const selectClassName = isDarkMode
    ? "h-7 cursor-pointer rounded-lg border border-white/10 bg-slate-800/60 px-2 text-xs text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-slate-900/70 disabled:text-slate-500 disabled:opacity-100 disabled:focus-visible:ring-0"
    : "h-7 cursor-pointer rounded-lg border border-slate-200 bg-white/80 px-2 text-xs text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100 disabled:focus-visible:ring-0";

  const labelClassName = isDarkMode
    ? "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400"
    : "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-500";

  const groupClassName = "flex min-w-[120px] flex-col gap-1";
  const hospitalControlGroupClassName = areHospitalControlsDisabled
    ? `${groupClassName} opacity-65`
    : groupClassName;

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

  return (
    <div className="absolute inset-x-0 top-0 z-[1000] px-4 pt-2">
      <section className={panelClassName}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center my-[-10px]">
            <Image
              src="/ArogyaMap.png"
              alt="ArogyaMap"
              width={220}
              height={50}
              priority
              className="h-15 w-auto object-contain"
            />
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

            <label
              aria-disabled={areHospitalControlsDisabled}
              className={hospitalControlGroupClassName}
            >
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
                disabled={areHospitalControlsDisabled}
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
                disabled={isDistrictDisabled}
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
              <label
                aria-disabled={areHospitalControlsDisabled}
                className={`${checkboxClassName} ${
                  areHospitalControlsDisabled
                    ? "cursor-not-allowed opacity-60"
                    : ""
                }`}
              >
                <input
                  aria-label="Show facilities open 24/7"
                  type="checkbox"
                  checked={state.availability.open247}
                  disabled={areHospitalControlsDisabled}
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
                className={`trust-slider h-7 w-full accent-cyan-500 ${
                  areHospitalControlsDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer"
                }`}
                type="range"
                min={0}
                max={100}
                step={10}
                value={state.trustMin}
                disabled={areHospitalControlsDisabled}
                onChange={(event) => onTrustChange(Number(event.target.value))}
              />
            </label>

            <div className={badgeClassName}>{facilityCount} facilities</div>

            {showResetButton ? (
              <button
                aria-label="Reset filters"
                className={`${resetButtonClassName} ${
                  areHospitalControlsDisabled
                    ? "cursor-not-allowed opacity-60 hover:bg-transparent"
                    : ""
                }`}
                disabled={areHospitalControlsDisabled}
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
