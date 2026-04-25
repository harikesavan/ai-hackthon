export type Capability =
  | "Emergency Surgery"
  | "ICU Availability"
  | "Trauma Care"
  | "Dialysis"
  | "Oncology";

export type CapabilityStatus = "full" | "partial" | "missing";
export type ReviewStatus =
  | "pending"
  | "confirmed_real"
  | "confirmed_ghost"
  | "needs_visit";

export type LocationFilter = {
  country: string;
  state: string;
  district: string;
};

export type AvailabilityFilters = {
  open247: boolean;
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

export type RuleViolation = {
  rule: string;
  description: string;
  citation: string;
  severity?: string;
};

export type FacilityCard = {
  id: number;
  facilityName: string;
  facilityType: string | null;
  state: string | null;
  district: string | null;
  lat: number | null;
  lon: number | null;
  trustMin: number | null;
  reviewStatus: ReviewStatus | null;
  ruleViolations: RuleViolation[] | null;
};
