/**
 * LocationContext
 * ---------------
 * Shared city/location state for all citizen pages.
 * When a citizen searches a city, every subscribed page updates automatically.
 */
import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface LocationInfo {
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  display_name: string;
}

export interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  precipitation: number;
  condition: string;
  condition_code: number;
  last_updated: string;
}

export interface ForecastDay {
  date: string;
  day_name: string;
  high: number;
  low: number;
  condition: string;
  condition_code: number;
  precipitation_sum: number;
  wind_max: number;
}

export interface AQIData {
  aqi_us: number | null;
  aqi_category: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
  last_updated: string;
}

export interface CitizenData {
  location: LocationInfo;
  weather: CurrentWeather;
  forecast: ForecastDay[];
  aqi: AQIData;
  traffic_status: string;
  water_status: string;
  last_updated: string;
}

interface LocationContextType {
  data: CitizenData | null;
  loading: boolean;
  error: string;
  locationMode: 'auto' | 'manual';
  searchLocation: (query: string) => Promise<void>;
  searchLocationAuto: (query: string) => Promise<void>; // only sets if still in auto mode
  setManualMode: () => void;
  setAutoMode: () => void;
  clearError: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authFetch } = useAuth();
  const [data, setData]             = useState<CitizenData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [locationMode, setLocationMode] = useState<'auto' | 'manual'>('auto');

  // Ref mirrors locationMode so callbacks can read it without stale closures
  const locationModeRef = useRef<'auto' | 'manual'>('auto');
  const updateMode = (m: 'auto' | 'manual') => {
    locationModeRef.current = m;
    setLocationMode(m);
  };

  const _doFetch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) return;
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(
        `/api/citizen/dashboard?q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) {
        let detail = 'Live data temporarily unavailable';
        try { const j = await res.json(); detail = j.detail || detail; } catch { /* skip */ }
        setError(detail);
        return;
      }
      const json: CitizenData = await res.json();
      setData(json);
    } catch (e) {
      if (e instanceof TypeError && e.message.includes('fetch')) {
        setError('Network error — could not reach the server');
      } else {
        setError('Live data temporarily unavailable');
      }
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // Manual search — always fetches AND switches to manual mode
  const searchLocation = useCallback(async (query: string) => {
    updateMode('manual');
    await _doFetch(query);
  }, [_doFetch]);

  // Auto search — only fetches if still in auto mode (won't overwrite manual selection)
  const searchLocationAuto = useCallback(async (query: string) => {
    if (locationModeRef.current === 'manual') return; // user selected manually — don't overwrite
    await _doFetch(query);
  }, [_doFetch]);

  const setManualMode = useCallback(() => updateMode('manual'), []);
  const setAutoMode   = useCallback(() => updateMode('auto'),   []);
  const clearError    = useCallback(() => setError(''), []);

  return (
    <LocationContext.Provider value={{
      data, loading, error, locationMode,
      searchLocation, searchLocationAuto,
      setManualMode, setAutoMode, clearError,
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be inside <LocationProvider>');
  return ctx;
};
