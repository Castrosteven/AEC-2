import { useState } from "react";
import { usePlacesWidget } from "react-google-autocomplete";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from '@/components/ui/input'
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import './App.css'
import { Label } from "./components/ui/label";
import { MapboxMap } from "@/components/MapboxMap";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function App() {
  const [mapViewState, setMapViewState] = useState({
    longitude: -100.0,
    latitude: 40.0,
    zoom: 3.5
  });
  const [markerPosition, setMarkerPosition] = useState<{ longitude: number; latitude: number } | null>(null);

  const { ref } = usePlacesWidget({
    apiKey: API_KEY,
    onPlaceSelected: (place) => {
      console.log('Place selected:', place);

      // Extract coordinates from the selected place
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Update map view to center on the selected location
        setMapViewState({
          longitude: lng,
          latitude: lat,
          zoom: 12
        });

        // Set marker at the selected location
        setMarkerPosition({
          longitude: lng,
          latitude: lat
        });
      }
    },
     options: {
      types: ["address"],
      componentRestrictions: { country: "us" },
    },
  })

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          App
        </h4>
        <ModeToggle />
      </header>

      {/* Main Content */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <div className="h-full border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="google-places-auto-complete" className="text-sm font-medium">
                Search for a location
              </Label>
              <Input
                id="google-places-auto-complete"
                ref={ref}
                placeholder="Enter a location..."
                className="w-full"
              />
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors" />

        {/* Center Panel */}
        <Panel defaultSize={50} minSize={30}>
          <div className="h-full p-4">
            <MapboxMap
              viewState={mapViewState}
              onMove={setMapViewState}
              markerPosition={markerPosition}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors" />

        {/* Right Panel */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <div className="h-full border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Right Panel</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This is the right panel (~25% width)
            </p>
          </div>
        </Panel>
      </PanelGroup>
    </div>

  )
}

export default App


