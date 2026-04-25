"use client";

import { FacilityLayer } from "@/components/FacilityLayer";
import type { LatLngBoundsExpression } from "leaflet";
import { MapContainer, TileLayer } from "react-leaflet";
import type { Capability, Facility } from "@/types/healthcare";

type MapViewProps = {
  facilities: Facility[];
  capability: Capability;
  isDarkMode: boolean;
  selectedFacilityId: string | null;
  onSelectFacility: (facilityId: string) => void;
};

const indiaBounds: LatLngBoundsExpression = [
  [6, 68],
  [37.5, 97.5],
];

const indiaPaddedBounds: LatLngBoundsExpression = [
  [1, 68],
  [42.5, 97.5],
];

export const MapView = ({
  facilities,
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
