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
      <div className="mt-4 space-y-2">
        <p className={isDarkMode ? "text-slate-300" : "text-slate-600"}>
          Reviewer actions
        </p>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className={
              reviewStatus === "confirmed_ghost"
                ? "rounded-md bg-slate-500 px-2 py-2 text-xs font-medium text-white"
                : "rounded-md bg-red-500 px-2 py-2 text-xs font-medium text-white hover:bg-red-400"
            }
            disabled={isSubmittingReview || reviewStatus === "confirmed_ghost"}
            onClick={() => handleReviewSubmit("confirmed_ghost")}
          >
            Confirm Ghost
          </button>
          <button
            type="button"
            className={
              reviewStatus === "confirmed_real"
                ? "rounded-md bg-slate-500 px-2 py-2 text-xs font-medium text-white"
                : "rounded-md bg-green-600 px-2 py-2 text-xs font-medium text-white hover:bg-green-500"
            }
            disabled={isSubmittingReview || reviewStatus === "confirmed_real"}
            onClick={() => handleReviewSubmit("confirmed_real")}
          >
            Confirm Real
          </button>
          <button
            type="button"
            className={
              reviewStatus === "needs_visit"
                ? "rounded-md bg-slate-500 px-2 py-2 text-xs font-medium text-white"
                : "rounded-md bg-amber-500 px-2 py-2 text-xs font-medium text-slate-950 hover:bg-amber-400"
            }
            disabled={isSubmittingReview || reviewStatus === "needs_visit"}
            onClick={() => handleReviewSubmit("needs_visit")}
          >
            Needs Site Visit
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
