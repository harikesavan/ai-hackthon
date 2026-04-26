"use client";

import { useEffect, useMemo } from "react";
import { FacilityLayer } from "@/components/FacilityLayer";
import type { LocationFilter } from "@/types/healthcare";
import type { LatLngBoundsExpression } from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Capability, Facility } from "@/types/healthcare";

type MapViewProps = {
  facilities: Facility[];
  allFacilities: Facility[];
  location: LocationFilter;
  capability: Capability;
  isDarkMode: boolean;
  selectedFacilityId: string | null;
  flyToCoords: [number, number] | null;
  onSelectFacility: (facilityId: string) => void;
  onResetSelection: () => void;
};

const indiaBounds: LatLngBoundsExpression = [
  [6, 64],
  [37.5, 101.5],
];

const indiaPaddedBounds: LatLngBoundsExpression = [
  [1, 58],
  [42.5, 107],
];

const buildBoundsFromFacilities = (
  facilities: Facility[],
): LatLngBoundsExpression | null => {
  if (facilities.length === 0) {
    return null;
  }

  const validFacilities = facilities.filter(
    (facility) => Number.isFinite(facility.lat) && Number.isFinite(facility.lng),
  );
  if (validFacilities.length === 0) {
    return null;
  }

  if (validFacilities.length === 1) {
    const [singleFacility] = validFacilities;
    return [
      [singleFacility.lat, singleFacility.lng],
      [singleFacility.lat, singleFacility.lng],
    ];
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  validFacilities.forEach((facility) => {
    minLat = Math.min(minLat, facility.lat);
    maxLat = Math.max(maxLat, facility.lat);
    minLng = Math.min(minLng, facility.lng);
    maxLng = Math.max(maxLng, facility.lng);
  });

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
};

const CustomZoomControl = ({
  isDarkMode,
  onResetSelection,
}: {
  isDarkMode: boolean;
  onResetSelection: () => void;
}) => {
  const map = useMap();

  const btnClass = isDarkMode
    ? "w-9 h-9 rounded-xl border border-white/10 bg-slate-900/85 text-slate-300 hover:bg-slate-800 flex items-center justify-center transition-colors shadow-lg"
    : "w-9 h-9 rounded-xl border border-slate-200/50 bg-white/85 text-slate-600 hover:bg-white flex items-center justify-center transition-colors shadow-lg";

  return (
    <div className="absolute bottom-28 left-4 z-[1000] flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        className={btnClass}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M7 1v12M1 7h12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        className={btnClass}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 7h12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => {
          onResetSelection();
          map.fitBounds(indiaBounds, { padding: [24, 24], animate: true, duration: 0.8 });
        }}
        aria-label="Reset view"
        className={btnClass}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1v5h5" />
          <path d="M2 10a6 6 0 1 0 1.5-6.3L1 6" />
        </svg>
      </button>
    </div>
  );
};

const MapViewportController = ({
  allFacilities,
  location,
}: {
  allFacilities: Facility[];
  location: LocationFilter;
}) => {
  const map = useMap();

  const filteredByLocation = useMemo(() => {
    return allFacilities.filter((facility) => {
      if (location.state !== "All" && facility.state !== location.state) {
        return false;
      }
      if (location.district !== "All" && facility.district !== location.district) {
        return false;
      }
      return true;
    });
  }, [allFacilities, location.district, location.state]);

  useEffect(() => {
    const shouldZoomToSelection =
      location.state !== "All" || location.district !== "All";
    const hasSingleTarget = filteredByLocation.length === 1;

    if (!shouldZoomToSelection) {
      map.fitBounds(indiaBounds, { padding: [24, 24] });
      return;
    }

    const targetBounds = buildBoundsFromFacilities(filteredByLocation);
    if (!targetBounds) {
      return;
    }

    if (hasSingleTarget) {
      const [facility] = filteredByLocation;
      map.setView([facility.lat, facility.lng], 10);
      return;
    }

    map.fitBounds(targetBounds, {
      padding: [40, 40],
      maxZoom: location.district !== "All" ? 10 : 8,
    });
  }, [filteredByLocation, location.district, location.state, map]);

  return null;
};

const FlyToSelected = ({
  selectedFacilityId,
  flyToCoords,
  allFacilities,
}: {
  selectedFacilityId: string | null;
  flyToCoords: [number, number] | null;
  allFacilities: Facility[];
}) => {
  const map = useMap();

  useEffect(() => {
    if (flyToCoords) {
      map.flyTo(flyToCoords, 13, { duration: 1.2 });
      return;
    }
    if (!selectedFacilityId) return;
    const facility = allFacilities.find((f) => f.id === selectedFacilityId);
    if (!facility || !Number.isFinite(facility.lat) || !Number.isFinite(facility.lng)) return;
    map.flyTo([facility.lat, facility.lng], 13, { duration: 1.2 });
  }, [selectedFacilityId, flyToCoords, allFacilities, map]);

  return null;
};

export const MapView = ({
  facilities,
  allFacilities,
  location,
  capability,
  isDarkMode,
  selectedFacilityId,
  flyToCoords,
  onSelectFacility,
  onResetSelection,
}: MapViewProps) => {
  const tileUrl = isDarkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <section className="relative h-full w-full overflow-hidden">
      <MapContainer
        key={isDarkMode ? "dark-map" : "light-map"}
        bounds={indiaBounds}
        minZoom={4.5}
        maxZoom={16}
        maxBounds={indiaPaddedBounds}
        maxBoundsViscosity={0.7}
        zoomControl={false}
        className="h-full w-full"
      >
         <TileLayer
           url={tileUrl}
           attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
         />
         <MapViewportController allFacilities={allFacilities} location={location} />
         <FlyToSelected selectedFacilityId={selectedFacilityId} flyToCoords={flyToCoords} allFacilities={allFacilities} />
         <FacilityLayer
           facilities={facilities}
           capability={capability}
           selectedFacilityId={selectedFacilityId}
           onSelectFacility={onSelectFacility}
         />
         <CustomZoomControl isDarkMode={isDarkMode} onResetSelection={onResetSelection} />
      </MapContainer>
    </section>
  );
};
