import { z } from "zod";
// NASA APOD Tool
const nasaApodTool = {
    name: "nasa_apod",
    description: "Get Astronomy Picture of the Day from NASA API",
    schema: {
        date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
        hd: z.boolean().default(true).describe("Return high-resolution image URL"),
        api_key: z.string().optional().describe("NASA API key (optional, uses demo key)")
    },
    handler: async ({ date, hd, api_key }) => {
        try {
            const apiKey = api_key || 'DEMO_KEY';
            const baseUrl = 'https://api.nasa.gov/planetary/apod';
            const params = new URLSearchParams({
                api_key: apiKey,
                hd: hd.toString()
            });
            if (date) {
                params.set('date', date);
            }
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 403) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Invalid NASA API key. Please provide a valid NASA API key or get one free from https://api.nasa.gov/"
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
                        type: "text",
                        text: JSON.stringify({
                            source: "NASA APOD API",
                            title: data.title,
                            explanation: data.explanation,
                            date: data.date,
                            media_type: data.media_type,
                            url: data.url,
                            hd_url: hd ? data.hdurl : null,
                            service_version: data.service_version,
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching NASA APOD: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// NASA Asteroids Tool
const nasaAsteroidsTool = {
    name: "nasa_asteroids",
    description: "Get asteroid data from NASA's NeoWS API",
    schema: {
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD format"),
        api_key: z.string().optional().describe("NASA API key (optional, uses demo key)")
    },
    handler: async ({ start_date, end_date, api_key }) => {
        try {
            const apiKey = api_key || 'DEMO_KEY';
            const baseUrl = 'https://api.nasa.gov/neo/rest/v1/feed';
            const params = new URLSearchParams({
                api_key: apiKey
            });
            // Default to today if no dates provided
            const today = new Date().toISOString().split('T')[0];
            const startDate = start_date || today;
            const endDate = end_date || today;
            params.set('start_date', startDate);
            params.set('end_date', endDate);
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 403) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Invalid NASA API key. Please provide a valid NASA API key or get one free from https://api.nasa.gov/"
                            }
                        ]
                    };
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const asteroids = [];
            // Flatten the nested asteroid data
            Object.keys(data.near_earth_objects).forEach(date => {
                data.near_earth_objects[date].forEach((asteroid) => {
                    asteroids.push(asteroid);
                });
            });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "NASA NeoWS API",
                            date_range: {
                                start_date: startDate,
                                end_date: endDate
                            },
                            total_asteroids: asteroids.length,
                            potentially_hazardous: asteroids.filter(a => a.is_potentially_hazardous_asteroid).length,
                            asteroids: asteroids.map(asteroid => ({
                                id: asteroid.id,
                                name: asteroid.name,
                                absolute_magnitude: asteroid.absolute_magnitude_h,
                                estimated_diameter_km: {
                                    min: asteroid.estimated_diameter.kilometers.estimated_diameter_min,
                                    max: asteroid.estimated_diameter.kilometers.estimated_diameter_max
                                },
                                is_potentially_hazardous: asteroid.is_potentially_hazardous_asteroid,
                                close_approach_date: asteroid.close_approach_data[0]?.close_approach_date,
                                relative_velocity_kmh: asteroid.close_approach_data[0]?.relative_velocity.kilometers_per_hour,
                                miss_distance_km: asteroid.close_approach_data[0]?.miss_distance.kilometers
                            })),
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching asteroid data: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// NASA Mars Photos Tool
const nasaMarsPhotosTool = {
    name: "nasa_mars_photos",
    description: "Get Mars rover photos from NASA API",
    schema: {
        rover: z.enum(['curiosity', 'opportunity', 'spirit']).default('curiosity').describe("Mars rover name"),
        sol: z.number().min(0).default(1000).describe("Martian sol (day) number"),
        camera: z.string().optional().describe("Camera abbreviation (e.g., 'FHAZ', 'RHAZ', 'MAST')"),
        page: z.number().min(1).default(1).describe("Page number"),
        api_key: z.string().optional().describe("NASA API key (optional, uses demo key)")
    },
    handler: async ({ rover, sol, camera, page, api_key }) => {
        try {
            const apiKey = api_key || 'DEMO_KEY';
            const baseUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos`;
            const params = new URLSearchParams({
                sol: sol.toString(),
                page: page.toString(),
                api_key: apiKey
            });
            if (camera) {
                params.set('camera', camera);
            }
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                if (response.status === 403) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "Invalid NASA API key. Please provide a valid NASA API key or get one free from https://api.nasa.gov/"
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
                        type: "text",
                        text: JSON.stringify({
                            source: "NASA Mars Photos API",
                            rover: rover,
                            sol: sol,
                            camera_filter: camera,
                            page: page,
                            total_photos: data.photos.length,
                            photos: data.photos.map((photo) => ({
                                id: photo.id,
                                sol: photo.sol,
                                earth_date: photo.earth_date,
                                img_src: photo.img_src,
                                camera: {
                                    name: photo.camera.name,
                                    full_name: photo.camera.full_name
                                },
                                rover: {
                                    name: photo.rover.name,
                                    status: photo.rover.status,
                                    total_photos: photo.rover.total_photos
                                }
                            })),
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching Mars photos: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// Launch Library API Tool
const launchLibraryTool = {
    name: "launch_library",
    description: "Get upcoming space launches from Launch Library API",
    schema: {
        limit: z.number().min(1).max(50).default(10).describe("Number of launches to fetch (1-50)"),
        status: z.enum(['go', 'tbd', 'tbc', 'hold', 'inflight', 'fail', 'partial', 'success']).optional().describe("Launch status filter"),
        upcoming: z.boolean().default(true).describe("Show upcoming launches only")
    },
    handler: async ({ limit, status, upcoming }) => {
        try {
            const baseUrl = 'https://ll.thespacedevs.com/2.0.0/launch';
            const params = new URLSearchParams({
                limit: limit.toString(),
                mode: 'detailed'
            });
            if (status) {
                params.set('status', status);
            }
            if (upcoming) {
                params.set('net', `gt_${new Date().toISOString()}`);
            }
            const response = await fetch(`${baseUrl}?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "Launch Library API",
                            total_launches: data.count,
                            returned_launches: data.results.length,
                            filters: {
                                status,
                                upcoming
                            },
                            launches: data.results.map((launch) => ({
                                id: launch.id,
                                name: launch.name,
                                status: launch.status.name,
                                net: launch.net,
                                window_start: launch.window_start,
                                window_end: launch.window_end,
                                rocket: {
                                    name: launch.rocket.configuration.name,
                                    family: launch.rocket.configuration.family,
                                    variant: launch.rocket.configuration.variant
                                },
                                mission: {
                                    name: launch.mission.name,
                                    description: launch.mission.description,
                                    type: launch.mission.type,
                                    orbit: launch.mission.orbit?.name
                                },
                                pad: {
                                    name: launch.pad.name,
                                    location: launch.pad.location.name,
                                    country: launch.pad.location.country_code
                                }
                            })),
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching launch data: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
// ISS Position Tool
const issPositionTool = {
    name: "iss_position",
    description: "Get current ISS position from Open Notify API",
    schema: {},
    handler: async () => {
        try {
            const response = await fetch('https://api.open-notify.org/iss-now.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "Open Notify ISS API",
                            timestamp: data.timestamp,
                            iss_position: {
                                latitude: parseFloat(data.iss_position.latitude),
                                longitude: parseFloat(data.iss_position.longitude)
                            },
                            message: data.message,
                            fetched_at: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching ISS position: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                ]
            };
        }
    }
};
export const scienceApisAdapter = {
    name: "science-apis",
    description: "Science and space APIs including NASA, ISS tracking, and launch data",
    tools: [
        nasaApodTool,
        nasaAsteroidsTool,
        nasaMarsPhotosTool,
        launchLibraryTool,
        issPositionTool
    ]
};
