"use client";

import { useState } from "react";
import { getStatusLabel } from "@/lib/map-utils";
import type { Facility, MapState, ReviewStatus } from "@/types/healthcare";

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
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const [reviewMessage, setReviewMessage] = useState("");

  if (!facility) {
    return null;
  }

  const statusBadgeClasses: Record<string, { dark: string; light: string }> = {
    full: {
      dark: "bg-green-500/15 text-green-400 border border-green-500/20",
      light: "bg-green-50 text-green-700 border border-green-200",
    },
    partial: {
      dark: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
      light: "bg-yellow-50 text-yellow-700 border border-yellow-200",
    },
    missing: {
      dark: "bg-red-500/15 text-red-400 border border-red-500/20",
      light: "bg-red-50 text-red-700 border border-red-200",
    },
  };

  const handleReviewSubmit = async (status: ReviewStatus) => {
    setIsSubmittingReview(true);
    setReviewMessage("");
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facilityId: Number(facility.id),
          status,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save review");
      }

      setReviewStatus(status);
      setReviewMessage("Review saved.");
    } catch (error) {
      console.error(error);
      setReviewMessage("Could not save review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const capabilityStatus = facility.capabilities[capability];
  const badgeClasses = statusBadgeClasses[capabilityStatus][isDarkMode ? "dark" : "light"];
  const dividerClasses = isDarkMode ? "border-t border-white/10 my-3" : "border-t border-slate-200 my-3";
  const panelClasses = isDarkMode
    ? "absolute left-4 top-20 z-[1000] w-[360px] rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-sm text-slate-200 shadow-2xl backdrop-blur-xl"
    : "absolute left-4 top-20 z-[1000] w-[360px] rounded-2xl border border-slate-200/50 bg-white/80 p-5 text-sm text-slate-700 shadow-2xl backdrop-blur-xl";
  const closeButtonClassName = isDarkMode
    ? "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
    : "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40";
  const actionButtonBaseClassName =
    "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium leading-none whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed";

  return (
    <section className={panelClasses}>
      <div className="flex items-start justify-between gap-3">
        <h2
          className={
            isDarkMode ? "text-base font-bold text-cyan-300" : "text-base font-bold text-cyan-700"
          }
        >
          {facility.name}
        </h2>
        <button
          aria-label="Close facility details"
          className={closeButtonClassName}
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className={dividerClasses} />
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium opacity-70">Trust Score</span>
            <span className="text-xs font-bold">{facility.trust}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${facility.trust}%`,
                background:
                  facility.trust > 70
                    ? "linear-gradient(to right, #22c55e, #4ade80)"
                    : facility.trust >= 30
                      ? "linear-gradient(to right, #eab308, #facc15)"
                      : "linear-gradient(to right, #ef4444, #f87171)",
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium opacity-70">Capability</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses}`}
          >
            {getStatusLabel(capabilityStatus)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium opacity-70">Distance</span>
          <span className="text-sm font-medium">{facility.distanceKm} km</span>
        </div>
      </div>
      <div className={dividerClasses} />
      <div className="space-y-2 text-xs opacity-70">
        <p>
          <span className="font-semibold">Evidence:</span> {facility.evidence}
        </p>
        <p>
          <span className="font-semibold">Trust explanation:</span> {facility.trustExplanation}
        </p>
      </div>
      <div className={dividerClasses} />
      <div className="space-y-2">
        <p className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
          Reviewer actions
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={
              reviewStatus === "confirmed_ghost"
                ? `${actionButtonBaseClassName} bg-slate-500 text-white`
                : `${actionButtonBaseClassName} bg-red-500 text-white hover:bg-red-400`
             }
             disabled={isSubmittingReview || reviewStatus === "confirmed_ghost"}
             onClick={() => handleReviewSubmit("confirmed_ghost")}
           >
             <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 12 12" fill="none">
               <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.25" />
               <path
                 d="M4.25 7.75L7.75 4.25"
                 stroke="currentColor"
                 strokeWidth="1.25"
                 strokeLinecap="round"
               />
             </svg>
             Confirm Ghost
          </button>
          <button
            type="button"
            className={
              reviewStatus === "confirmed_real"
                ? `${actionButtonBaseClassName} bg-slate-500 text-white`
                : `${actionButtonBaseClassName} bg-green-600 text-white hover:bg-green-500`
             }
             disabled={isSubmittingReview || reviewStatus === "confirmed_real"}
             onClick={() => handleReviewSubmit("confirmed_real")}
           >
             <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 12 12" fill="none">
               <path
                 d="M2.5 6.5L4.75 8.75L9.5 4"
                 stroke="currentColor"
                 strokeWidth="1.5"
                 strokeLinecap="round"
                 strokeLinejoin="round"
               />
             </svg>
             Confirm Real
          </button>
          <button
            type="button"
            className={
              reviewStatus === "needs_visit"
                ? `${actionButtonBaseClassName} bg-slate-500 text-white`
                : `${actionButtonBaseClassName} bg-amber-500 text-slate-950 hover:bg-amber-400`
             }
             disabled={isSubmittingReview || reviewStatus === "needs_visit"}
             onClick={() => handleReviewSubmit("needs_visit")}
           >
             <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 12 12" fill="none">
               <path
                 d="M1.5 6C2.55 3.85 4.125 2.75 6 2.75C7.875 2.75 9.45 3.85 10.5 6C9.45 8.15 7.875 9.25 6 9.25C4.125 9.25 2.55 8.15 1.5 6Z"
                 stroke="currentColor"
                 strokeWidth="1.1"
                 strokeLinejoin="round"
               />
               <circle cx="6" cy="6" r="1.4" fill="currentColor" />
             </svg>
            Needs Visit
          </button>
        </div>
        {reviewMessage ? (
          <p className={isDarkMode ? "text-xs text-cyan-300" : "text-xs text-cyan-700"}>
            {reviewMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
};
