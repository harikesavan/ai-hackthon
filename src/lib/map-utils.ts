import type {
  CapabilityStatus,
  Facility,
  MapState,
} from "@/types/healthcare";

export const statusColorMap: Record<CapabilityStatus, string> = {
  full: "#22c55e",
  partial: "#eab308",
  missing: "#ef4444",
};

export const getStatusLabel = (status: CapabilityStatus): string => {
  if (status === "full") {
    return "Fully capable";
  }
  if (status === "partial") {
    return "Partially capable";
  }
  return "Critical gap";
};

export const filterFacilities = (
  facilities: Facility[],
  state: MapState,
): Facility[] => {
  return facilities.filter((facility) => {
    if (
      state.location.country !== "All" &&
      facility.country !== state.location.country
    ) {
      return false;
    }
    if (state.location.state !== "All" && facility.state !== state.location.state) {
      return false;
    }
    if (
      state.location.district !== "All" &&
      facility.district !== state.location.district
    ) {
      return false;
    }
    if (facility.trust < state.trustMin) {
      return false;
    }
    if (state.availability.open247 && !facility.open247) {
      return false;
    }
    return true;
  });
};

