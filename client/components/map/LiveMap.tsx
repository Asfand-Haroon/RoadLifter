'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, TileLayer as LeafletTileLayer } from 'leaflet';

interface LiveMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
  onMapReady?: (map: LeafletMap) => void;
  children?: React.ReactNode;
}

let L: typeof import('leaflet');

const LiveMap: React.FC<LiveMapProps> = ({
  center = [40.7128, -74.006],
  zoom = 12,
  className,
  style,
  onMapReady,
  children,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current!, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
      });

      // Dark CARTO tile layer (authenticated)
      const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
      const tileUrl = cartoApiKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';

      const tileLayer = L.tileLayer(
        tileUrl,
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      );
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      // Custom zoom control position
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      onMapReady?.(map);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mapRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
};

export default LiveMap;
export type { LeafletMap };
