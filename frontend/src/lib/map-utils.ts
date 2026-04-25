import { capabilities } from "@/data/facilities";
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

export const parseQueryToState = (query: string): Partial<MapState> => {
  const normalized = query.toLowerCase();
  const parsedState: Partial<MapState> = {};
  const parsedLocation: Partial<MapState["location"]> = {};
  const parsedAvailability: Partial<MapState["availability"]> = {};

  const capabilityMatch = capabilities.find((capability) =>
    normalized.includes(capability.toLowerCase().split(" ")[0]),
  );
  if (capabilityMatch) {
    parsedState.capability = capabilityMatch;
  }

  if (normalized.includes("bihar")) {
    parsedLocation.state = "Bihar";
  }
  if (normalized.includes("jharkhand")) {
    parsedLocation.state = "Jharkhand";
  }
  if (Object.keys(parsedLocation).length > 0) {
    parsedState.location = parsedLocation as MapState["location"];
  }

  if (normalized.includes("24/7") || normalized.includes("open")) {
    parsedAvailability.open247 = true;
  }
  if (normalized.includes("full-time") || normalized.includes("full time")) {
    parsedAvailability.staffing = "full-time";
  }
  if (normalized.includes("part-time") || normalized.includes("part time")) {
    parsedAvailability.staffing = "part-time";
  }
  if (Object.keys(parsedAvailability).length > 0) {
    parsedState.availability = parsedAvailability as MapState["availability"];
  }

  const trustMatch = normalized.match(/trust\s*>\s*(\d{2,3})/);
  if (trustMatch) {
    parsedState.trustMin = Number(trustMatch[1]);
  } else if (
    normalized.includes("high trust") ||
    normalized.includes("high reliability")
  ) {
    parsedState.trustMin = 80;
  } else if (normalized.includes("low trust")) {
    parsedState.trustMin = 0;
  }

  return parsedState;
};

export const getParsedSummary = (state: MapState): string => {
  return [
    state.capability,
    state.location.state !== "All" ? state.location.state : "Any state",
    `Trust > ${state.trustMin}%`,
    state.availability.open247 ? "Open 24/7" : "Any schedule",
    state.availability.staffing === "full-time"
      ? "Full-time staff"
      : "Part-time staff",
  ].join(" | ");
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
    if (
      state.availability.staffing === "full-time" &&
      !facility.fullTimeStaffOnly
    ) {
      return false;
    }
    if (
      state.availability.staffing === "part-time" &&
      facility.fullTimeStaffOnly
    ) {
      return false;
    }
    return true;
  });
};

export type PositionedFacility = Facility & {
  x: number;
  y: number;
};

export const buildMarkerPositions = (
  facilities: Facility[],
): PositionedFacility[] => {
  const minLat = 22.5;
  const maxLat = 26.4;
  const minLng = 84.2;
  const maxLng = 87;

  return facilities.map((facility) => {
    const x = ((facility.lng - minLng) / (maxLng - minLng)) * 100;
    const y = 100 - ((facility.lat - minLat) / (maxLat - minLat)) * 100;

    return {
      ...facility,
      x: Math.min(98, Math.max(2, x)),
      y: Math.min(98, Math.max(2, y)),
    };
  });
};
