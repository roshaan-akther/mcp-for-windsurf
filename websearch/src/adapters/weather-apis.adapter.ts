import { z } from "zod";
import { Tool, Adapter } from "./adapter.js";

// Types for weather APIs
interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime: string;
  };
  current: {
    last_updated: string;
    temp_c: number;
    temp_f: number;
    is_day: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_mph: number;
    wind_kph: number;
    wind_degree: number;
    wind_dir: string;
    pressure_mb: number;
    pressure_in: number;
    precip_mm: number;
    precip_in: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    vis_km: number;
    vis_miles: number;
    uv: number;
    gust_mph: number;
    gust_kph: number;
  };
}

interface AirQualityData {
  coord: {
    lon: number;
    lat: number;
  };
  list: Array<{
    dt: number;
    main: {
      aqi: number;
    };
    components: {
      co: number;
      no: number;
      no2: number;
      o3: number;
      so2: number;
      pm2_5: number;
      pm10: number;
      nh3: number;
    };
  }>;
}

// OpenWeatherMap Current Weather Tool
const openWeatherCurrentTool: Tool = {
  name: "openweather_current",
  description: "Get current weather data from OpenWeatherMap API",
  schema: {
    location: z.string().min(1).describe("City name or coordinates (lat,lon)"),
    units: z.enum(['metric', 'imperial', 'standard']).default('metric').describe("Temperature units"),
    api_key: z.string().optional().describe("OpenWeatherMap API key (optional, uses demo key)")
  },
  handler: async ({ location, units, api_key }) => {
    try {
      // Use demo API key if none provided
      const apiKey = api_key || 'demo';
      const baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
      const params = new URLSearchParams({
        q: location,
        appid: apiKey,
        units: units
      });

      const response = await fetch(`${baseUrl}?${params}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Invalid API key. Please provide a valid OpenWeatherMap API key or get one free from https://openweathermap.org/api"
              }
            ]
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "OpenWeatherMap API",
              location: data.name,
              coordinates: {
                lat: data.coord.lat,
                lon: data.coord.lon
              },
              weather: {
                main: data.weather[0].main,
                description: data.weather[0].description,
                icon: data.weather[0].icon
              },
              temperature: {
                current: data.main.temp,
                feels_like: data.main.feels_like,
                min: data.main.temp_min,
                max: data.main.temp_max,
                units: units
              },
              conditions: {
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                visibility: data.visibility,
                wind_speed: data.wind?.speed,
                wind_direction: data.wind?.deg,
                clouds: data.clouds?.all
              },
              sunrise: data.sys?.sunrise,
              sunset: data.sys?.sunset,
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching weather: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// WeatherAPI Current Weather Tool
const weatherApiCurrentTool: Tool = {
  name: "weatherapi_current",
  description: "Get current weather data from WeatherAPI.com",
  schema: {
    location: z.string().min(1).describe("City name or coordinates (lat,lon)"),
    api_key: z.string().optional().describe("WeatherAPI.com key (optional, uses demo key)")
  },
  handler: async ({ location, api_key }) => {
    try {
      // Use demo API key if none provided
      const apiKey = api_key || 'demo';
      const baseUrl = 'https://api.weatherapi.com/v1/current.json';
      const params = new URLSearchParams({
        key: apiKey,
        q: location,
        aqi: 'yes'
      });

      const response = await fetch(`${baseUrl}?${params}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Invalid API key. Please provide a valid WeatherAPI.com key or get one free from https://www.weatherapi.com/"
              }
            ]
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "WeatherAPI.com",
              location: data.location,
              current: data.current,
              air_quality: data.current?.air_quality,
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching weather: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// OpenWeatherMap Air Pollution Tool
const openWeatherAirPollutionTool: Tool = {
  name: "openweather_air_pollution",
  description: "Get air pollution data from OpenWeatherMap API",
  schema: {
    location: z.string().min(1).describe("City name or coordinates (lat,lon)"),
    api_key: z.string().optional().describe("OpenWeatherMap API key (optional, uses demo key)")
  },
  handler: async ({ location, api_key }) => {
    try {
      // First geocode the location to get coordinates
      const apiKey = api_key || 'demo';
      
      // Get coordinates from location name
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${location}&limit=1&appid=${apiKey}`;
      const geoResponse = await fetch(geoUrl);
      
      if (!geoResponse.ok) {
        throw new Error(`Geocoding failed: ${geoResponse.status}`);
      }
      
      const geoData = await geoResponse.json();
      
      if (geoData.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Location "${location}" not found`
            }
          ]
        };
      }
      
      const { lat, lon } = geoData[0];
      
      // Get air pollution data
      const pollutionUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      const pollutionResponse = await fetch(pollutionUrl);
      
      if (!pollutionResponse.ok) {
        throw new Error(`Air pollution API failed: ${pollutionResponse.status}`);
      }
      
      const pollutionData = await pollutionResponse.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "OpenWeatherMap Air Pollution API",
              location: {
                name: location,
                coordinates: { lat, lon }
              },
              air_quality: pollutionData.list[0],
              aqi_description: getAQIDescription(pollutionData.list[0].main.aqi),
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching air pollution data: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

// Helper function to get AQI description
function getAQIDescription(aqi: number): string {
  switch (aqi) {
    case 1: return 'Good';
    case 2: return 'Fair';
    case 3: return 'Moderate';
    case 4: return 'Poor';
    case 5: return 'Very Poor';
    default: return 'Unknown';
  }
}

// WeatherAPI Forecast Tool
const weatherApiForecastTool: Tool = {
  name: "weatherapi_forecast",
  description: "Get weather forecast from WeatherAPI.com",
  schema: {
    location: z.string().min(1).describe("City name or coordinates (lat,lon)"),
    days: z.number().min(1).max(3).default(3).describe("Number of forecast days (1-3)"),
    api_key: z.string().optional().describe("WeatherAPI.com key (optional, uses demo key)")
  },
  handler: async ({ location, days, api_key }) => {
    try {
      const apiKey = api_key || 'demo';
      const baseUrl = 'https://api.weatherapi.com/v1/forecast.json';
      const params = new URLSearchParams({
        key: apiKey,
        q: location,
        days: days.toString(),
        aqi: 'yes',
        alerts: 'yes'
      });

      const response = await fetch(`${baseUrl}?${params}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Invalid API key. Please provide a valid WeatherAPI.com key or get one free from https://www.weatherapi.com/"
              }
            ]
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              source: "WeatherAPI.com",
              location: data.location,
              current: data.current,
              forecast: data.forecast,
              alerts: data.alerts,
              fetched_at: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching forecast: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
};

export const weatherApisAdapter: Adapter = {
  name: "weather-apis",
  description: "Weather and air quality APIs from multiple providers",
  tools: [
    openWeatherCurrentTool,
    weatherApiCurrentTool,
    openWeatherAirPollutionTool,
    weatherApiForecastTool
  ]
};
