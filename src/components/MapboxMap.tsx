import { useRef, useState, useCallback, useEffect } from 'react';
import Map, { type MapRef, Marker, NavigationControl, GeolocateControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface MapboxMapProps {
  viewState?: ViewState;
  onMove?: (viewState: ViewState) => void;
  markerPosition?: { longitude: number; latitude: number } | null;
  geojsonData?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  height?: string;
  width?: string;
  className?: string;
}

export function MapboxMap({
  viewState,
  onMove,
  markerPosition: externalMarkerPosition,
  geojsonData,
  fillColor = '#088',
  fillOpacity = 0.4,
  strokeColor = '#088',
  strokeWidth = 2,
  height = '100%',
  width = '100%',
  className = ''
}: MapboxMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [internalViewState, setInternalViewState] = useState<ViewState>({
    longitude: -100.0,
    latitude: 40.0,
    zoom: 3.5
  });
  const [clickedMarker, setClickedMarker] = useState<{ longitude: number; latitude: number } | null>(null);

  // Sync external viewState to internal state
  useEffect(() => {
    if (viewState) {
      setInternalViewState(viewState);
    }
  }, [viewState]);

  const handleMapClick = useCallback((event: any) => {
    const { lngLat } = event;
    setClickedMarker({
      longitude: lngLat.lng,
      latitude: lngLat.lat
    });
    console.log('Map clicked at:', lngLat);
  }, []);

  const handleMove = useCallback((evt: any) => {
    const newViewState = {
      longitude: evt.viewState.longitude,
      latitude: evt.viewState.latitude,
      zoom: evt.viewState.zoom
    };
    setInternalViewState(newViewState);
    onMove?.(newViewState);
  }, [onMove]);

  const currentViewState = viewState || internalViewState;
  const displayMarker = externalMarkerPosition || clickedMarker;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 font-semibold mb-2">
            Mapbox Token Missing
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height, width }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        {...currentViewState}
        onMove={handleMove}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
      >
        {/* Navigation controls (zoom in/out, compass) */}
        <NavigationControl position="top-right" />

        {/* Geolocate control (find user's location) */}
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserHeading
        />

        {/* GeoJSON data layer */}
        {geojsonData && (
          <Source id="geojson-data" type="geojson" data={geojsonData}>
            {/* Fill layer for polygons */}
            <Layer
              id="geojson-fill"
              type="fill"
              paint={{
                'fill-color': fillColor,
                'fill-opacity': fillOpacity
              }}
            />
            {/* Line layer for polygon borders and LineStrings */}
            <Layer
              id="geojson-line"
              type="line"
              paint={{
                'line-color': strokeColor,
                'line-width': strokeWidth
              }}
            />
            {/* Circle layer for points */}
            <Layer
              id="geojson-point"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': strokeColor,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
              }}
            />
          </Source>
        )}

        {/* Marker at selected/clicked location */}
        {displayMarker && (
          <Marker
            longitude={displayMarker.longitude}
            latitude={displayMarker.latitude}
            anchor="bottom"
          >
            <div className="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg transform -translate-y-1/2" />
          </Marker>
        )}
      </Map>
    </div>
  );
}
