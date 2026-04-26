"use client";

import { Fragment } from "react";
import { getStatusLabel } from "@/lib/map-utils";
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
  const getFillColor = (trust: number) => {
    const trustRatio = trust / 100;
    if (trustRatio > 0.7) {
      return "#22c55e";
    }
    if (trustRatio >= 0.3) {
      return "#eab308";
    }
    return "#ef4444";
  };

  return (
    <>
       {facilities.map((facility) => {
         const status = facility.capabilities[capability];
         const radius = Math.max(6, Math.floor(facility.capacity / 18));

         return (
           <Fragment key={facility.id}>
             {selectedFacilityId === facility.id && (
               <CircleMarker
                 key={`${facility.id}-ring`}
                 center={[facility.lat, facility.lng]}
                 radius={radius + 8}
                 pathOptions={{
                   color: "#22d3ee",
                  className: "pointer-events-none",
                   weight: 2,
                   fillColor: "transparent",
                   fillOpacity: 0,
                   opacity: 0.5,
                   dashArray: "6 4",
                 }}
               />
             )}
             <CircleMarker
               key={`${facility.id}-marker`}
               center={[facility.lat, facility.lng]}
               radius={radius}
               pathOptions={{
                  className: "cursor-pointer",
                 color: selectedFacilityId === facility.id ? "#67e8f9" : "#ffffff",
                 weight: selectedFacilityId === facility.id ? 2.5 : 1,
                 fillColor: getFillColor(facility.trust),
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
           </Fragment>
         );
       })}
    </>
  );
};
