"use client";

import { useEffect, useMemo } from "react";
import { FacilityLayer } from "@/components/FacilityLayer";
import type { LocationFilter } from "@/types/healthcare";
import type { LatLngBoundsExpression } from "leaflet";
import { ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Capability, Facility, MapViewMode } from "@/types/healthcare";
import indiaPolygon from "../../polygon.json";

type MapViewProps = {
  facilities: Facility[];
  allFacilities: Facility[];
  view: MapViewMode;
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

const indiaBoundsNumeric: [[number, number], [number, number]] = [
  [6, 64],
  [37.5, 101.5],
];

const FACILITY_FOCUS_ZOOM = 12;
const MAP_TRANSITION_DURATION_SECONDS = 0.7;
const FACILITY_FOCUS_DURATION_SECONDS = 0.45;

const INDIA_MAINLAND_POLYGON =
  indiaPolygon.geometry.coordinates[0] as Array<[number, number]>;

const DESERT_PALETTE: Array<{ ratio: number; color: [number, number, number] }> = [
  { ratio: 0, color: [34, 197, 94] },
  { ratio: 0.2, color: [22, 163, 74] },
  { ratio: 0.55, color: [250, 204, 21] },
  { ratio: 0.75, color: [245, 158, 11] },
  { ratio: 1, color: [220, 38, 38] },
];

const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const isPointInPolygon = (
  pointLng: number,
  pointLat: number,
  polygon: Array<[number, number]>,
): boolean => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [currentLng, currentLat] = polygon[index];
    const [previousLng, previousLat] = polygon[previous];
    const intersects =
      currentLat > pointLat !== previousLat > pointLat &&
      pointLng <
        ((previousLng - currentLng) * (pointLat - currentLat)) /
          (previousLat - currentLat) +
          currentLng;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
};

const getDesertRatioFromDistance = (distanceKm: number): number => {
  if (distanceKm <= 15) {
    return (distanceKm / 15) * 0.18;
  }
  if (distanceKm <= 55) {
    return 0.18 + ((distanceKm - 15) / 40) * 0.42;
  }
  if (distanceKm <= 140) {
    return 0.6 + ((distanceKm - 55) / 85) * 0.4;
  }
  return 1;
};

const mixPaletteColor = (
  ratio: number,
): { red: number; green: number; blue: number } => {
  const clampedRatio = clamp01(ratio);
  for (let index = 1; index < DESERT_PALETTE.length; index += 1) {
    const previousStop = DESERT_PALETTE[index - 1];
    const currentStop = DESERT_PALETTE[index];
    if (clampedRatio > currentStop.ratio) {
      continue;
    }
    const stopSpan = currentStop.ratio - previousStop.ratio;
    const localRatio =
      stopSpan === 0 ? 0 : (clampedRatio - previousStop.ratio) / stopSpan;
    return {
      red: Math.round(lerp(previousStop.color[0], currentStop.color[0], localRatio)),
      green: Math.round(lerp(previousStop.color[1], currentStop.color[1], localRatio)),
      blue: Math.round(lerp(previousStop.color[2], currentStop.color[2], localRatio)),
    };
  }
  const fallback = DESERT_PALETTE[DESERT_PALETTE.length - 1].color;
  return { red: fallback[0], green: fallback[1], blue: fallback[2] };
};

const createDesertOverlayUrl = (
  facilities: Facility[],
  isDarkMode: boolean,
): string | null => {
  if (typeof document === "undefined" || facilities.length === 0) {
    return null;
  }

  const gridWidth = 220;
  const gridHeight = 220;
  const [southWest, northEast] = indiaBoundsNumeric;
  const [minLat, minLng] = southWest;
  const [maxLat, maxLng] = northEast;

  const stride = Math.max(1, Math.floor(facilities.length / 1400));
  const sampleFacilities = facilities.filter((_, index) => index % stride === 0);
  if (sampleFacilities.length === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const image = context.createImageData(gridWidth, gridHeight);
  const kmPerLatDegree = 111.32;

  for (let y = 0; y < gridHeight; y += 1) {
    const latitude = lerp(maxLat, minLat, y / (gridHeight - 1));
    const longitudeScale = kmPerLatDegree * Math.cos((latitude * Math.PI) / 180);
    for (let x = 0; x < gridWidth; x += 1) {
      const longitude = lerp(minLng, maxLng, x / (gridWidth - 1));
      const pixelOffset = (y * gridWidth + x) * 4;

      if (!isPointInPolygon(longitude, latitude, INDIA_MAINLAND_POLYGON)) {
        image.data[pixelOffset + 3] = 0;
        continue;
      }

      let nearestKm = Number.POSITIVE_INFINITY;

      for (const facility of sampleFacilities) {
        const distanceLat = (facility.lat - latitude) * kmPerLatDegree;
        const distanceLng = (facility.lng - longitude) * longitudeScale;
        const distanceKm = Math.sqrt(distanceLat * distanceLat + distanceLng * distanceLng);
        if (distanceKm < nearestKm) {
          nearestKm = distanceKm;
        }
      }

      const distanceRatio = getDesertRatioFromDistance(nearestKm);
      const color = mixPaletteColor(distanceRatio);
      const baseAlpha = isDarkMode ? 150 : 135;
      const alpha = Math.round(baseAlpha + 85 * distanceRatio);

      image.data[pixelOffset] = color.red;
      image.data[pixelOffset + 1] = color.green;
      image.data[pixelOffset + 2] = color.blue;
      image.data[pixelOffset + 3] = alpha;
    }
  }

  context.putImageData(image, 0, 0);

  const blurredCanvas = document.createElement("canvas");
  blurredCanvas.width = gridWidth;
  blurredCanvas.height = gridHeight;
  const blurredContext = blurredCanvas.getContext("2d");
  if (!blurredContext) {
    return canvas.toDataURL("image/png");
  }
  blurredContext.filter = "blur(1.4px)";
  blurredContext.drawImage(canvas, 0, 0);
  return blurredCanvas.toDataURL("image/png");
};

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
    ? "flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-slate-900/85 text-slate-300 shadow-lg transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
    : "flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200/50 bg-white/85 text-slate-600 shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50";

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
          map.fitBounds(indiaBounds, {
            padding: [24, 24],
            animate: true,
            duration: MAP_TRANSITION_DURATION_SECONDS,
            easeLinearity: 0.2,
          });
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
      map.fitBounds(indiaBounds, {
        padding: [24, 24],
        animate: true,
        duration: MAP_TRANSITION_DURATION_SECONDS,
        easeLinearity: 0.2,
      });
      return;
    }

    const targetBounds = buildBoundsFromFacilities(filteredByLocation);
    if (!targetBounds) {
      return;
    }

    if (hasSingleTarget) {
      const [facility] = filteredByLocation;
      map.flyTo([facility.lat, facility.lng], 10, {
        animate: true,
        duration: MAP_TRANSITION_DURATION_SECONDS,
        easeLinearity: 0.2,
      });
      return;
    }

    map.fitBounds(targetBounds, {
      padding: [40, 40],
      maxZoom: location.district !== "All" ? 10 : 8,
      animate: true,
      duration: MAP_TRANSITION_DURATION_SECONDS,
      easeLinearity: 0.2,
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
    const focusFacility = (targetCoords: [number, number]) => {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      const isAlreadyFocused =
        Math.abs(currentCenter.lat - targetCoords[0]) < 0.0008 &&
        Math.abs(currentCenter.lng - targetCoords[1]) < 0.0008 &&
        Math.abs(currentZoom - FACILITY_FOCUS_ZOOM) < 0.2;
      if (isAlreadyFocused) {
        return;
      }

      map.stop();
      map.setView(targetCoords, FACILITY_FOCUS_ZOOM, {
        animate: true,
        duration: FACILITY_FOCUS_DURATION_SECONDS,
        easeLinearity: 0.25,
      });
    };

    if (flyToCoords) {
      focusFacility(flyToCoords);
      return;
    }
    if (!selectedFacilityId) return;
    const facility = allFacilities.find((f) => f.id === selectedFacilityId);
    if (!facility || !Number.isFinite(facility.lat) || !Number.isFinite(facility.lng)) return;
    focusFacility([facility.lat, facility.lng]);
  }, [selectedFacilityId, flyToCoords, allFacilities, map]);

  return null;
};

const DesertOverlay = ({
  facilities,
  isDarkMode,
}: {
  facilities: Facility[];
  isDarkMode: boolean;
}) => {
  const overlayUrl = useMemo(
    () => createDesertOverlayUrl(facilities, isDarkMode),
    [facilities, isDarkMode],
  );

  if (!overlayUrl) {
    return null;
  }

  return (
    <ImageOverlay
      url={overlayUrl}
      bounds={indiaBounds}
      opacity={isDarkMode ? 0.68 : 0.56}
      zIndex={260}
    />
  );
};

export const MapView = ({
  facilities,
  allFacilities,
  view,
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
        preferCanvas
        markerZoomAnimation={false}
        maxBounds={indiaPaddedBounds}
        maxBoundsViscosity={0.7}
        zoomControl={false}
        className="h-full w-full"
      >
         <TileLayer
           url={tileUrl}
           attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
         />
         {view === "deserts" ? (
           <DesertOverlay facilities={facilities} isDarkMode={isDarkMode} />
         ) : null}
         <MapViewportController allFacilities={allFacilities} location={location} />
         <FlyToSelected selectedFacilityId={selectedFacilityId} flyToCoords={flyToCoords} allFacilities={allFacilities} />
         {view === "hospitals" ? (
           <FacilityLayer
             facilities={facilities}
             capability={capability}
             selectedFacilityId={selectedFacilityId}
             onSelectFacility={onSelectFacility}
           />
         ) : null}
         <CustomZoomControl isDarkMode={isDarkMode} onResetSelection={onResetSelection} />
      </MapContainer>
    </section>
  );
};
