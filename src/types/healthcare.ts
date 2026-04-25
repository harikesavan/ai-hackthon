export type Capability =
  | "Emergency Surgery"
  | "ICU Availability"
  | "Trauma Care"
  | "Dialysis"
  | "Oncology";

export type CapabilityStatus = "full" | "partial" | "missing";

export type LocationFilter = {
  country: string;
  state: string;
  district: string;
};

export type AvailabilityFilters = {
  open247: boolean;
  staffing: "full-time" | "part-time";
};

export type MapState = {
  capability: Capability;
  location: LocationFilter;
  trustMin: number;
  availability: AvailabilityFilters;
};

export type Facility = {
  id: string;
  name: string;
  country: string;
  state: string;
  district: string;
  rural: boolean;
  open247: boolean;
  fullTimeStaffOnly: boolean;
  trust: number;
  lat: number;
  lng: number;
  capacity: number;
  distanceKm: number;
  evidence: string;
  trustExplanation: string;
  capabilities: Record<Capability, CapabilityStatus>;
};
