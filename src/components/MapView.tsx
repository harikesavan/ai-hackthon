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
  onSelectFacility: (facilityId: string) => void;
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

export const MapView = ({
  facilities,
  allFacilities,
  location,
  capability,
  isDarkMode,
  selectedFacilityId,
  onSelectFacility,
}: MapViewProps) => {
  const tileUrl = isDarkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <section className="relative h-full w-full overflow-hidden">
      <MapContainer
        key={isDarkMode ? "dark-map" : "light-map"}
        bounds={indiaBounds}
        minZoom={4.5}
        maxZoom={10}
        maxBounds={indiaPaddedBounds}
        maxBoundsViscosity={0.7}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapViewportController allFacilities={allFacilities} location={location} />
        <FacilityLayer
          facilities={facilities}
          capability={capability}
          selectedFacilityId={selectedFacilityId}
          onSelectFacility={onSelectFacility}
        />
      </MapContainer>
    </section>
  );
};
