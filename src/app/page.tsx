"use client";

import { useMemo, useState } from "react";
import { FacilityDetailPanel } from "@/components/FacilityDetailPanel";
import { Legend } from "@/components/Legend";
import { SearchInput } from "@/components/SearchInput";
import { TopBar } from "@/components/TopBar";
import { defaultMapState, testFacilities } from "@/data/facilities";
import {
  filterFacilities,
  parseQueryToState,
} from "@/lib/map-utils";
import type { Facility, MapState } from "@/types/healthcare";
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("@/components/MapView").then((module) => module.MapView),
  { ssr: false },
);

export default function Home() {
  const [mapState, setMapState] = useState<MapState>(defaultMapState);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const states = useMemo(() => {
    const options = testFacilities.filter((facility) => {
      if (mapState.location.country === "All") {
        return true;
      }
      return facility.country === mapState.location.country;
    });
    return ["All", ...new Set(options.map((facility) => facility.state))];
  }, [mapState.location.country]);

  const districts = useMemo(() => {
    const options = testFacilities.filter((facility) => {
      if (mapState.location.state === "All") {
        return true;
      }
      return facility.state === mapState.location.state;
    });
    return ["All", ...new Set(options.map((facility) => facility.district))];
  }, [mapState.location.state]);

  const filteredFacilities = useMemo(() => {
    return filterFacilities(testFacilities, mapState);
  }, [mapState]);

  const selectedFacility = useMemo<Facility | null>(() => {
    if (!selectedFacilityId) {
      return null;
    }
    return testFacilities.find((facility) => facility.id === selectedFacilityId) ?? null;
  }, [selectedFacilityId]);

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

  const handleApplyQuery = () => {
    if (!query.trim()) {
      return;
    }

    const parsedState = parseQueryToState(query);
    setSelectedFacilityId(null);
    setMapState((previous) => {
      const next = {
        ...previous,
        ...parsedState,
        location: {
          ...previous.location,
          ...(parsedState.location ?? {}),
        },
        availability: {
          ...previous.availability,
          ...(parsedState.availability ?? {}),
        },
      };
      return next;
    });
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
    </main>
  );
}
