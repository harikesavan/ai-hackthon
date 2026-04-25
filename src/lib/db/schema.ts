import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),

  // Identity
  facilityName: text("facility_name").notNull(),
  facilityType: text("facility_type"), // PHC, CHC, District Hospital, etc.
  facilityTypeConfidence: text("facility_type_confidence"), // high, medium, low
  ownershipType: text("ownership_type"), // Government, Private, Trust, etc.

  // Location
  state: text("state"),
  district: text("district"),
  subDistrict: text("sub_district"),
  address: text("address"),
  pincode: text("pincode"),
  lat: real("lat"),
  lon: real("lon"),

  // Capacity
  beds: integer("beds"),
  doctors: integer("doctors"),

  // Extracted data (from LLM)
  services: jsonb("services").$type<string[]>(), // ["Emergency 24/7", "Surgery", "ICU"]
  equipment: jsonb("equipment").$type<string[]>(), // ["Ventilator", "X-Ray"]
  specialties: jsonb("specialties").$type<string[]>(), // ["Cardiology", "Orthopedics"]
  staffDetails: jsonb("staff_details").$type<{ name?: string; specialty: string }[]>(),
  operatingHours: text("operating_hours"),
  emergencyAvailable: boolean("emergency_available"),

  // Trust Signal 1: Extraction confidence
  extractionConfidence: text("extraction_confidence"), // high, medium, low
  unsupportedClaims: jsonb("unsupported_claims").$type<
    { field: string; value: string; reason: string }[]
  >(),

  // Trust Signal 2: Rule violations (IPHS 2022)
  ruleViolations: jsonb("rule_violations").$type<
    { rule: string; description: string; citation: string }[]
  >(),

  // Trust Signal 3: Peer anomaly
  peerAnomalyPercentile: real("peer_anomaly_percentile"), // 0-100
  peerAnomalyFlags: jsonb("peer_anomaly_flags").$type<string[]>(),

  // Combined (min of 3 signals, for map coloring)
  trustMin: real("trust_min"), // 0.0 to 1.0

  // Human review
  reviewStatus: text("review_status").default("pending"), // pending, confirmed_real, confirmed_ghost, needs_visit
  reviewedAt: timestamp("reviewed_at"),

  // Raw data
  rawNotes: text("raw_notes"), // original unstructured text
  rawSummary: text("raw_summary"), // 1-sentence LLM summary

  // Metadata
  dataSource: text("data_source"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for use in API routes
export type Facility = typeof facilities.$inferSelect;
export type NewFacility = typeof facilities.$inferInsert;
