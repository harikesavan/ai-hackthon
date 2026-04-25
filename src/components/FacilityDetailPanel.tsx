"use client";

import { getStatusLabel } from "@/lib/map-utils";
import type { Facility, MapState } from "@/types/healthcare";

type FacilityDetailPanelProps = {
  facility: Facility | null;
  capability: MapState["capability"];
  isDarkMode: boolean;
  onClose: () => void;
};

export const FacilityDetailPanel = ({
  facility,
  capability,
  isDarkMode,
  onClose,
}: FacilityDetailPanelProps) => {
  if (!facility) {
    return null;
  }

  return (
    <section
      className={
        isDarkMode
          ? "absolute left-4 top-[180px] z-[1000] w-[360px] rounded-xl border border-white/20 bg-slate-900/85 p-4 text-sm shadow-2xl backdrop-blur-sm"
          : "absolute left-4 top-[180px] z-[1000] w-[360px] rounded-xl border border-slate-200 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur-sm"
      }
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2
          className={
            isDarkMode ? "text-base font-semibold text-cyan-300" : "text-base font-semibold text-cyan-700"
          }
        >
          {facility.name}
        </h2>
        <button
          aria-label="Close facility details"
          className={
            isDarkMode
              ? "rounded-md bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
              : "rounded-md bg-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-300"
          }
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
      <div className={isDarkMode ? "space-y-2 text-slate-200" : "space-y-2 text-slate-700"}>
        <p>
          <strong>Trust:</strong> {facility.trust}%
        </p>
        <p>
          <strong>Distance:</strong> {facility.distanceKm} km
        </p>
        <p>
          <strong>Capability status:</strong>{" "}
          {getStatusLabel(facility.capabilities[capability])}
        </p>
        <p>
          <strong>Evidence:</strong> {facility.evidence}
        </p>
        <p>
          <strong>Trust explanation:</strong> {facility.trustExplanation}
        </p>
      </div>
    </section>
  );
};
