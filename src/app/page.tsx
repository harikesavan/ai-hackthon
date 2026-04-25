"use client";

import { useEffect, useMemo, useState } from "react";
import { FacilityDetailPanel } from "@/components/FacilityDetailPanel";
import { Legend } from "@/components/Legend";
import { SearchInput } from "@/components/SearchInput";
import { TopBar } from "@/components/TopBar";
import { capabilities, defaultMapState } from "@/data/facilities";
import { filterFacilities } from "@/lib/map-utils";
import type {
  CapabilityStatus,
  Facility,
  FacilityCard,
  MapState,
} from "@/types/healthcare";
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/components/MapView").then((module) => module.MapView),
  { ssr: false },
);

type MapFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    id?: number | string;
    name?: string;
    state?: string | null;
    district?: string | null;
    beds?: number | null;
    services?: string[] | null;
    emergencyAvailable?: boolean | null;
    trustMin?: number | null;
    reviewStatus?: string | null;
  };
};

type FacilitiesApiResponse = {
  count: number;
  facilities: unknown[];
};

type ChatApiResponse = {
  answer?: string;
  facilities?: unknown[];
};

const getCapabilityStatusFromTrust = (
  trustMin: number | null | undefined,
): CapabilityStatus => {
  if (trustMin === null || trustMin === undefined) {
    return "missing";
  }
  if (trustMin > 0.7) {
    return "full";
  }
  if (trustMin >= 0.3) {
    return "partial";
  }
  return "missing";
};

const normalizeFacilityCard = (item: unknown): FacilityCard | null => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const payload = item as Record<string, unknown>;
  const rawId = payload.id;
  if (typeof rawId !== "number") {
    return null;
  }

  const facilityName =
    (typeof payload.facilityName === "string" && payload.facilityName) ||
    (typeof payload.facility_name === "string" && payload.facility_name) ||
    (typeof payload.name === "string" && payload.name) ||
    "Unnamed facility";

  const facilityType =
    (typeof payload.facilityType === "string" && payload.facilityType) ||
    (typeof payload.facility_type === "string" && payload.facility_type) ||
    null;

  const state =
    (typeof payload.state === "string" && payload.state) || null;
  const district =
    (typeof payload.district === "string" && payload.district) || null;

  const lat =
    typeof payload.lat === "number"
      ? payload.lat
      : typeof payload.latitude === "number"
        ? payload.latitude
        : null;

  const lon =
    typeof payload.lon === "number"
      ? payload.lon
      : typeof payload.lng === "number"
        ? payload.lng
        : typeof payload.longitude === "number"
          ? payload.longitude
          : null;

  const trustMin =
    typeof payload.trustMin === "number"
      ? payload.trustMin
      : typeof payload.trust_min === "number"
        ? payload.trust_min
        : null;

  const reviewStatus =
    typeof payload.reviewStatus === "string"
      ? payload.reviewStatus
      : typeof payload.review_status === "string"
        ? payload.review_status
        : null;

  const ruleViolations = Array.isArray(payload.ruleViolations)
    ? payload.ruleViolations
    : Array.isArray(payload.rule_violations)
      ? payload.rule_violations
      : null;

  return {
    id: rawId,
    facilityName,
    facilityType,
    state,
    district,
    lat,
    lon,
    trustMin,
    reviewStatus: reviewStatus as FacilityCard["reviewStatus"],
    ruleViolations: ruleViolations as FacilityCard["ruleViolations"],
  };
};

export default function Home() {
  const [mapState, setMapState] = useState<MapState>(defaultMapState);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [chatAnswer, setChatAnswer] = useState("");
  const [facilityCards, setFacilityCards] = useState<FacilityCard[]>([]);
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);

  const states = useMemo(() => {
    const options = facilities.filter((facility) => {
      if (mapState.location.country === "All") {
        return true;
      }
      return facility.country === mapState.location.country;
    });
    return ["All", ...new Set(options.map((facility) => facility.state))];
  }, [facilities, mapState.location.country]);

  const districts = useMemo(() => {
    const options = facilities.filter((facility) => {
      if (mapState.location.state === "All") {
        return true;
      }
      return facility.state === mapState.location.state;
    });
    return ["All", ...new Set(options.map((facility) => facility.district))];
  }, [facilities, mapState.location.state]);

  const filteredFacilities = useMemo(() => {
    return filterFacilities(facilities, mapState);
  }, [facilities, mapState]);

  const selectedFacility = useMemo<Facility | null>(() => {
    if (!selectedFacilityId) {
      return null;
    }
    return facilities.find((facility) => facility.id === selectedFacilityId) ?? null;
  }, [facilities, selectedFacilityId]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const response = await fetch("/api/map-data");
        if (!response.ok) {
          throw new Error("Failed to load map data");
        }

        const payload = (await response.json()) as { features?: MapFeature[] };
        const nextFacilities = (payload.features ?? []).map((feature) => {
          const properties = feature.properties ?? {};
          const coordinates = feature.geometry?.coordinates ?? [0, 0];
          const trustMin = properties.trustMin;
          const trustStatus = getCapabilityStatusFromTrust(trustMin);
          const trustPercent =
            typeof trustMin === "number" ? Math.round(trustMin * 100) : 0;

          return {
            id: String(properties.id ?? crypto.randomUUID()),
            name: properties.name ?? "Unnamed facility",
            country: "India",
            state: properties.state ?? "Unknown",
            district: properties.district ?? "Unknown",
            rural: false,
            open247: Boolean(properties.emergencyAvailable),
            fullTimeStaffOnly: true,
            trust: trustPercent,
            lat: coordinates[1],
            lng: coordinates[0],
            capacity: typeof properties.beds === "number" ? properties.beds : 60,
            distanceKm: 0,
            evidence:
              Array.isArray(properties.services) && properties.services.length > 0
                ? properties.services.join(", ")
                : "No evidence details provided",
            trustExplanation:
              properties.reviewStatus === "confirmed_ghost"
                ? "Marked by reviewer as likely non-compliant."
                : "Derived from API trust score signals.",
            capabilities: capabilities.reduce<Facility["capabilities"]>(
              (accumulator, capability) => ({
                ...accumulator,
                [capability]: trustStatus,
              }),
              {} as Facility["capabilities"],
            ),
          };
        });

        setFacilities(nextFacilities);
      } catch (error) {
        console.error(error);
      }
    };

    fetchMapData();
  }, []);

  useEffect(() => {
    const shouldFetchCards =
      mapState.location.state !== "All" || mapState.location.district !== "All";

    if (!shouldFetchCards) {
      return;
    }

    const params = new URLSearchParams();
    if (mapState.location.state !== "All") {
      params.set("state", mapState.location.state);
    }
    if (mapState.location.district !== "All") {
      params.set("district", mapState.location.district);
    }
    params.set("limit", "20");

    const fetchFilteredCards = async () => {
      try {
        const response = await fetch(`/api/facilities?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load filtered facilities");
        }

        const payload = (await response.json()) as FacilitiesApiResponse;
        const nextCards = (payload.facilities ?? [])
          .map((item) => normalizeFacilityCard(item))
          .filter((item): item is FacilityCard => item !== null);
        setFacilityCards(nextCards);
      } catch (error) {
        console.error(error);
      }
    };

    fetchFilteredCards();
  }, [mapState.location.district, mapState.location.state]);

  const handleCapabilityChange = (capability: MapState["capability"]) => {
    setSelectedFacilityId(null);
    setMapState((previous) => ({ ...previous, capability }));
  };

  const handleLocationChange = (
    key: keyof MapState["location"],
    value: string,
  ) => {
    setSelectedFacilityId(null);
    setMapState((previous) => {
      if (key === "country" && typeof value === "string") {
        return {
          ...previous,
          location: {
            ...previous.location,
            country: value,
            state: "All",
            district: "All",
          },
        };
      }
      if (key === "state" && typeof value === "string") {
        return {
          ...previous,
          location: {
            ...previous.location,
            state: value,
            district: "All",
          },
        };
      }
      return {
        ...previous,
        location: {
          ...previous.location,
          [key]: value,
        },
      };
    });
  };

  const handleTrustChange = (trust: number) => {
    setSelectedFacilityId(null);
    setMapState((previous) => ({ ...previous, trustMin: trust }));
  };

  const handleAvailabilityChange = (
    key: keyof MapState["availability"],
    value: boolean | "full-time" | "part-time",
  ) => {
    setSelectedFacilityId(null);
    setMapState((previous) => ({
      ...previous,
      availability: {
        ...previous.availability,
        [key]: value,
      },
    }));
  };

  const handleApplyQuery = async () => {
    if (!query.trim()) {
      return;
    }

    setIsSubmittingQuery(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: query.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch chat response");
      }

      const payload = (await response.json()) as ChatApiResponse;
      setChatAnswer(payload.answer ?? "");
      const nextCards = (payload.facilities ?? [])
        .map((item) => normalizeFacilityCard(item))
        .filter((item): item is FacilityCard => item !== null);
      setFacilityCards(nextCards);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmittingQuery(false);
    }
  };

  const handleCardSelect = (card: FacilityCard) => {
    setSelectedFacilityId(String(card.id));
  };

  return (
    <main
      className={
        isDarkMode
          ? "relative h-screen w-full overflow-hidden bg-slate-950 text-white"
          : "relative h-screen w-full overflow-hidden bg-slate-100 text-slate-900"
      }
    >
      <TopBar
        state={mapState}
        isDarkMode={isDarkMode}
        states={states}
        districts={districts}
        onCapabilityChange={handleCapabilityChange}
        onLocationChange={handleLocationChange}
        onTrustChange={handleTrustChange}
        onAvailabilityChange={handleAvailabilityChange}
        onThemeToggle={() => setIsDarkMode((previous) => !previous)}
      />
      <MapView
        facilities={filteredFacilities}
        capability={mapState.capability}
        isDarkMode={isDarkMode}
        selectedFacilityId={selectedFacilityId}
        onSelectFacility={setSelectedFacilityId}
      />
      <Legend isDarkMode={isDarkMode} />
      <FacilityDetailPanel
        key={selectedFacility?.id ?? "no-selection"}
        facility={selectedFacility}
        capability={mapState.capability}
        isDarkMode={isDarkMode}
        onClose={() => setSelectedFacilityId(null)}
      />
      <SearchInput
        query={query}
        isDarkMode={isDarkMode}
        onQueryChange={setQuery}
        onSubmit={handleApplyQuery}
      />
      <section
        className={
          isDarkMode
            ? "absolute bottom-20 right-4 z-[1000] max-h-[55vh] w-[360px] overflow-auto rounded-xl border border-white/20 bg-slate-900/85 p-3 text-xs text-slate-100 shadow-2xl"
            : "absolute bottom-20 right-4 z-[1000] max-h-[55vh] w-[360px] overflow-auto rounded-xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-2xl"
        }
      >
        <p className={isDarkMode ? "mb-2 text-cyan-300" : "mb-2 text-cyan-700"}>
          {isSubmittingQuery ? "Thinking..." : chatAnswer || "Facility results"}
        </p>
        <div className="space-y-2">
          {facilityCards.map((card) => (
            <button
              key={card.id}
              className={
                isDarkMode
                  ? "w-full rounded-md border border-white/10 bg-slate-800 p-2 text-left hover:bg-slate-700"
                  : "w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-left hover:bg-slate-100"
              }
              type="button"
              onClick={() => handleCardSelect(card)}
            >
              <p className="font-semibold">{card.facilityName}</p>
              <p>
                {card.facilityType ?? "Unknown type"} | {card.state ?? "Unknown"} /{" "}
                {card.district ?? "Unknown"}
              </p>
              <p>
                Trust:{" "}
                {typeof card.trustMin === "number"
                  ? `${Math.round(card.trustMin * 100)}%`
                  : "Not scored"}
              </p>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
