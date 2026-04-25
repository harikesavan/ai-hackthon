"use client";

import { getStatusLabel, statusColorMap } from "@/lib/map-utils";
import type { Facility } from "@/types/healthcare";
import type { Capability } from "@/types/healthcare";
import { CircleMarker, Tooltip } from "react-leaflet";

type FacilityLayerProps = {
  facilities: Facility[];
  capability: Capability;
  selectedFacilityId: string | null;
  onSelectFacility: (facilityId: string) => void;
};

export const FacilityLayer = ({
  facilities,
  capability,
  selectedFacilityId,
  onSelectFacility,
}: FacilityLayerProps) => {
  return (
    <>
      {facilities.map((facility) => {
        const status = facility.capabilities[capability];
        const radius = Math.max(6, Math.floor(facility.capacity / 18));

        return (
          <CircleMarker
            key={facility.id}
            center={[facility.lat, facility.lng]}
            radius={radius}
            pathOptions={{
              color: selectedFacilityId === facility.id ? "#67e8f9" : "#ffffff",
              weight: selectedFacilityId === facility.id ? 2.5 : 1,
              fillColor: statusColorMap[status],
              fillOpacity: Math.max(0.35, facility.trust / 100),
            }}
            eventHandlers={{
              click: () => onSelectFacility(facility.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -2]} opacity={1}>
              <div className="text-xs">
                <strong>{facility.name}</strong>
                <br />
                {capability}: {getStatusLabel(status)}
                <br />
                Trust: {facility.trust}%
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
};
