// Space Map API Explorer
// Integrates multiple space APIs to provide comprehensive information about celestial objects

const API_ENDPOINTS = {
    // NASA JPL Small-Body Database - for asteroids and comets
    SBDB: 'https://ssd-api.jpl.nasa.gov/sbdb.api',
    
    // NASA Near-Earth Object Web Service - for near-Earth objects
    NEO_LOOKUP: 'https://api.nasa.gov/neo/rest/v1/neo',
    NEO_FEED: 'https://api.nasa.gov/neo/rest/v1/feed',
    
    // NASA Exoplanet Archive - for exoplanets (TAP service)
    EXOPLANET: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=',
    
    // AstronomyAPI - free API for stars and deep-sky objects (better CORS support)
    ASTRONOMY_API: 'https://api.astronomyapi.com/api/v2/search',
};

// NASA API key (demo key - replace with your own for production)
const NASA_API_KEY = 'DEMO_KEY';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const exampleBtns = document.querySelectorAll('.example-btn');

    // Search on button click
    searchBtn.addEventListener('click', performSearch);

    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Example button clicks
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            searchInput.value = query;
            performSearch();
        });
    });
});

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showError('Please enter a space object name to search.');
        return;
    }

    hideError();
    showLoading();
    clearResults();

    try {
        // Try multiple APIs in parallel
        const results = await Promise.allSettled([
            searchSBDB(query),           // Asteroids & Comets
            searchNeoWs(query),          // Near-Earth Objects
            searchExoplanet(query),      // Exoplanets
            searchAstronomyAPI(query),   // Stars, Galaxies, Deep-Sky
        ]);

        const successfulResults = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)
            .flat();

        hideLoading();

        if (successfulResults.length === 0) {
            // Try fallback as last resort
            const fallbackResult = createFallbackResult(query);
            if (fallbackResult) {
                displayResults([fallbackResult]);
                plotObjectsOnStarMap([fallbackResult], query);
            } else {
                showNoResults(query);
            }
        } else {
            displayResults(successfulResults);
            // Try to plot objects on the star map
            plotObjectsOnStarMap(successfulResults, query);
        }
    } catch (error) {
        hideLoading();
        showError(`An error occurred: ${error.message}`);
    }
}

// Search Small-Body Database (asteroids, comets)
async function searchSBDB(query) {
    try {
        const response = await fetch(`${API_ENDPOINTS.SBDB}?name=${encodeURIComponent(query)}`);
        if (!response.ok) {
            console.log(`SBDB API returned ${response.status} for query: ${query}`);
            return null;
        }
        
        const data = await response.json();
        if (!data || data.code !== '200' || !data.object) {
            console.log(`SBDB API: No object found for ${query}`);
            return null;
        }

        const obj = data.object;
        // Try to extract coordinates from orbit data
        let coordinates = null;
        if (obj.orbit && obj.orbit.epoch) {
            // For small bodies, we can't easily get current RA/Dec without ephemeris calculations
            // But we can include orbital elements if needed
        }
        
        return {
            name: obj.name || query,
            type: obj.object_class || 'Small Body',
            objectClass: obj.object_class,
            source: 'NASA SBDB',
            details: {
                'Designation': obj.designation || 'N/A',
                'Class': obj.object_class || 'N/A',
                'Absolute Magnitude (H)': obj.h_mag || 'N/A',
                'Diameter': obj.diameter ? `${obj.diameter.toFixed(2)} km` : 'N/A',
                'Rotation Period': obj.rot_per ? `${obj.rot_per} hours` : 'N/A',
                'Discovery Date': obj.discovery_date || 'N/A',
                'Orbit Class': obj.orbit_class || 'N/A',
            },
            orbitalData: obj.orbit || null,
            coordinates: coordinates,
        };
    } catch (error) {
        console.log(`SBDB API error for ${query}:`, error.message);
        return null;
    }
}

// Search NeoWs (Near-Earth Objects)
async function searchNeoWs(query) {
    try {
        // Try lookup by ID first
        let response = await fetch(`${API_ENDPOINTS.NEO_LOOKUP}/${encodeURIComponent(query)}?api_key=${NASA_API_KEY}`);
        
        if (!response.ok) {
            // Try feed search
            const today = new Date().toISOString().split('T')[0];
            response = await fetch(`${API_ENDPOINTS.NEO_FEED}?start_date=${today}&end_date=${today}&api_key=${NASA_API_KEY}`);
            if (!response.ok) {
                console.log(`NeoWs API returned ${response.status} for query: ${query}`);
                return null;
            }
            
            const data = await response.json();
            if (!data.near_earth_objects) return null;
            
            // Search in feed results
            for (const date in data.near_earth_objects) {
                const neos = data.near_earth_objects[date];
                const found = neos.find(neo => 
                    neo.name.toLowerCase().includes(query.toLowerCase()) ||
                    neo.id.toString() === query
                );
                if (found) {
                    return formatNeoResult(found);
                }
            }
            return null;
        }

        const data = await response.json();
        return formatNeoResult(data);
    } catch (error) {
        console.log(`NeoWs API error for ${query}:`, error.message);
        return null;
    }
}

function formatNeoResult(neo) {
    const closeApproaches = neo.close_approach_data || [];
    const latestApproach = closeApproaches[0];
    
    return {
        name: neo.name,
        type: 'Near-Earth Object',
        objectClass: neo.neo_reference_id,
        source: 'NASA NeoWs',
        details: {
            'NEO ID': neo.neo_reference_id || 'N/A',
            'Potentially Hazardous': neo.is_potentially_hazardous_asteroid ? 'Yes' : 'No',
            'Absolute Magnitude (H)': neo.absolute_magnitude_h || 'N/A',
            'Estimated Diameter (min)': neo.estimated_diameter?.meters?.estimated_diameter_min 
                ? `${neo.estimated_diameter.meters.estimated_diameter_min.toFixed(2)} m` : 'N/A',
            'Estimated Diameter (max)': neo.estimated_diameter?.meters?.estimated_diameter_max 
                ? `${neo.estimated_diameter.meters.estimated_diameter_max.toFixed(2)} m` : 'N/A',
            'Close Approach Date': latestApproach?.close_approach_date || 'N/A',
            'Relative Velocity': latestApproach?.relative_velocity?.kilometers_per_second 
                ? `${parseFloat(latestApproach.relative_velocity.kilometers_per_second).toFixed(2)} km/s` : 'N/A',
        },
    };
}

// Search Exoplanet Archive
async function searchExoplanet(query) {
    try {
        // SQL query to search exoplanets by name
        const sql = `SELECT pl_name, hostname, disc_year, pl_orbper, pl_bmassj, pl_radj, st_dist 
                     FROM ps WHERE pl_name LIKE '%${query}%' OR hostname LIKE '%${query}%' 
                     LIMIT 5`;
        
        const url = `${API_ENDPOINTS.EXOPLANET}${encodeURIComponent(sql)}&format=json`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        // Handle different response formats
        const results = Array.isArray(data) ? data : (data.data || []);
        if (results.length === 0) return null;

        // Return first result
        const planet = results[0];
        return {
            name: planet.pl_name || query,
            type: 'Exoplanet',
            source: 'NASA Exoplanet Archive',
            details: {
                'Host Star': planet.hostname || 'N/A',
                'Discovery Year': planet.disc_year || 'N/A',
                'Orbital Period': planet.pl_orbper ? `${parseFloat(planet.pl_orbper).toFixed(2)} days` : 'N/A',
                'Mass': planet.pl_bmassj ? `${parseFloat(planet.pl_bmassj).toFixed(4)} Jupiter masses` : 'N/A',
                'Radius': planet.pl_radj ? `${parseFloat(planet.pl_radj).toFixed(4)} Jupiter radii` : 'N/A',
                'Distance from Earth': planet.st_dist ? `${parseFloat(planet.st_dist).toFixed(2)} parsecs` : 'N/A',
            },
        };
    } catch (error) {
        // CORS or API issues - return null to allow other APIs to try
        console.log(`Exoplanet API error for ${query}:`, error.message);
        return null;
    }
}

// Search Astronomy API (stars, galaxies, deep-sky objects)
async function searchAstronomyAPI(query) {
    try {
        // Use a simple approach - check fallback first for known stars
        const fallback = createFallbackResult(query);
        if (fallback && fallback.coordinates) {
            return fallback;
        }

        // For now, rely on fallback data for common objects
        // Note: AstronomyAPI requires authentication for production use
        // We'll use the fallback system for common stars and objects
        
        return createFallbackResult(query);
    } catch (error) {
        console.log('Astronomy API error:', error);
        return createFallbackResult(query);
    }
}

// Enhanced fallback with more objects and better coordinate data
function createFallbackResult(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Expanded database of known objects
    const objectDatabase = {
        // Planets (Solar System)
        'mars': { 
            type: 'Planet', 
            details: { 
                'Type': 'Terrestrial Planet', 
                'Distance from Sun': '227.9 million km',
                'Orbital Period': '687 Earth days'
            }
        },
        'jupiter': { 
            type: 'Planet', 
            details: { 
                'Type': 'Gas Giant', 
                'Distance from Sun': '778.5 million km',
                'Orbital Period': '12 years'
            }
        },
        'saturn': { 
            type: 'Planet', 
            details: { 
                'Type': 'Gas Giant', 
                'Distance from Sun': '1.4 billion km',
                'Orbital Period': '29 years'
            }
        },
        'neptune': { 
            type: 'Planet', 
            details: { 
                'Type': 'Ice Giant', 
                'Distance from Sun': '4.5 billion km',
                'Orbital Period': '165 years'
            }
        },
        'venus': { 
            type: 'Planet', 
            details: { 
                'Type': 'Terrestrial Planet', 
                'Distance from Sun': '108.2 million km',
                'Orbital Period': '225 Earth days'
            }
        },
        'mercury': { 
            type: 'Planet', 
            details: { 
                'Type': 'Terrestrial Planet', 
                'Distance from Sun': '57.9 million km',
                'Orbital Period': '88 Earth days'
            }
        },
        'uranus': { 
            type: 'Planet', 
            details: { 
                'Type': 'Ice Giant', 
                'Distance from Sun': '2.9 billion km',
                'Orbital Period': '84 years'
            }
        },
        'earth': {
            type: 'Planet',
            details: {
                'Type': 'Terrestrial Planet',
                'Distance from Sun': '149.6 million km',
                'Orbital Period': '365.25 days'
            }
        },
        
        // Comets
        'halley': {
            type: 'Comet',
            details: {
                'Type': 'Periodic Comet',
                'Orbital Period': '75-76 years',
                'Last Perihelion': '1986',
                'Next Perihelion': '2061'
            }
        },
        "halley's comet": {
            type: 'Comet',
            details: {
                'Type': 'Periodic Comet',
                'Orbital Period': '75-76 years',
                'Last Perihelion': '1986',
                'Next Perihelion': '2061'
            }
        },
        'halley\'s comet': {
            type: 'Comet',
            details: {
                'Type': 'Periodic Comet',
                'Orbital Period': '75-76 years',
                'Last Perihelion': '1986',
                'Next Perihelion': '2061'
            }
        },
        
        // Galaxies
        'andromeda': {
            type: 'Galaxy',
            coordinates: { ra: 0.71, dec: 41.27 },
            details: {
                'Type': 'Spiral Galaxy',
                'Distance': '2.5 million light-years',
                'Right Ascension': '0h 42.7m',
                'Declination': '+41° 16\''
            }
        },
        "andromeda galaxy": {
            type: 'Galaxy',
            coordinates: { ra: 0.71, dec: 41.27 },
            details: {
                'Type': 'Spiral Galaxy',
                'Distance': '2.5 million light-years',
                'Right Ascension': '0h 42.7m',
                'Declination': '+41° 16\''
            }
        },
        
        // Exoplanets
        'trappist-1': {
            type: 'Star System',
            details: {
                'Type': 'Ultra-cool Dwarf Star',
                'Distance': '40 light-years',
                'Planets': '7 confirmed planets',
                'Habitable Zone': '3 planets in habitable zone'
            }
        },
    };

    // Check if it's in the database
    if (objectDatabase[lowerQuery]) {
        const obj = objectDatabase[lowerQuery];
        return {
            name: query.charAt(0).toUpperCase() + query.slice(1),
            type: obj.type,
            source: 'Celestial Database',
            details: obj.details,
            coordinates: obj.coordinates || null,
        };
    }
    
    // Check if it's a known star (has coordinates for plotting)
    if (KNOWN_STAR_COORDINATES[lowerQuery]) {
        const coords = KNOWN_STAR_COORDINATES[lowerQuery];
        return {
            name: query.charAt(0).toUpperCase() + query.slice(1),
            type: 'Star',
            source: 'Star Catalog',
            details: {
                'Type': 'Star',
                'Right Ascension': `${coords.ra.toFixed(2)} hours`,
                'Declination': `${coords.dec.toFixed(2)}°`,
            },
            coordinates: coords,
        };
    }
    
    return null;
}

// Known star coordinates for plotting (RA in hours, Dec in degrees)
const KNOWN_STAR_COORDINATES = {
    'sirius': { ra: 6.75, dec: -16.7 },
    'betelgeuse': { ra: 5.92, dec: 7.4 },
    'vega': { ra: 18.62, dec: 38.8 },
    'arcturus': { ra: 14.26, dec: 19.2 },
    'rigel': { ra: 5.24, dec: -8.2 },
    'procyon': { ra: 7.66, dec: 5.2 },
    'capella': { ra: 5.28, dec: 45.98 },
    'altair': { ra: 19.85, dec: 8.87 },
    'spica': { ra: 13.42, dec: -11.16 },
    'pollux': { ra: 7.76, dec: 28.0 },
    'fomalhaut': { ra: 22.96, dec: -29.6 },
    'deneb': { ra: 20.69, dec: 45.28 },
    'regulus': { ra: 10.14, dec: 11.97 },
    'polaris': { ra: 2.52, dec: 89.26 },
    'antares': { ra: 16.49, dec: -26.43 },
    'aldebaran': { ra: 4.60, dec: 16.51 },
    'mira': { ra: 2.19, dec: -2.98 },
    'castor': { ra: 7.57, dec: 31.79 },
};

function createFallbackResult(query) {
    // Fallback for objects not found in APIs but commonly searched
    const commonObjects = {
        'mars': { type: 'Planet', details: { 'Type': 'Terrestrial Planet', 'Distance from Sun': '227.9 million km' }},
        'jupiter': { type: 'Planet', details: { 'Type': 'Gas Giant', 'Distance from Sun': '778.5 million km' }},
        'saturn': { type: 'Planet', details: { 'Type': 'Gas Giant', 'Distance from Sun': '1.4 billion km' }},
        'neptune': { type: 'Planet', details: { 'Type': 'Ice Giant', 'Distance from Sun': '4.5 billion km' }},
        'venus': { type: 'Planet', details: { 'Type': 'Terrestrial Planet', 'Distance from Sun': '108.2 million km' }},
        'mercury': { type: 'Planet', details: { 'Type': 'Terrestrial Planet', 'Distance from Sun': '57.9 million km' }},
        'uranus': { type: 'Planet', details: { 'Type': 'Ice Giant', 'Distance from Sun': '2.9 billion km' }},
    };

    const lowerQuery = query.toLowerCase();
    if (commonObjects[lowerQuery]) {
        return {
            name: query.charAt(0).toUpperCase() + query.slice(1),
            type: commonObjects[lowerQuery].type,
            source: 'Solar System Database',
            details: commonObjects[lowerQuery].details,
        };
    }
    
    // Check if it's a known star
    if (KNOWN_STAR_COORDINATES[lowerQuery]) {
        const coords = KNOWN_STAR_COORDINATES[lowerQuery];
        return {
            name: query.charAt(0).toUpperCase() + query.slice(1),
            type: 'Star',
            source: 'Star Catalog',
            details: {
                'Type': 'Star',
                'Right Ascension': `${coords.ra.toFixed(2)} hours`,
                'Declination': `${coords.dec.toFixed(2)}°`,
            },
            coordinates: coords,
        };
    }
    
    return null;
}

function displayResults(results) {
    const container = document.getElementById('resultsContainer');
    
    results.forEach(result => {
        const card = createResultCard(result);
        container.appendChild(card);
    });
}

function createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'object-type';
    typeBadge.textContent = result.type;

    const title = document.createElement('h2');
    title.textContent = result.name;
    if (result.source) {
        const source = document.createElement('span');
        source.style.fontSize = '0.6em';
        source.style.color = '#a0a0d0';
        source.textContent = ` (${result.source})`;
        title.appendChild(source);
    }

    card.appendChild(typeBadge);
    card.appendChild(title);

    if (result.details) {
        const detailsSection = document.createElement('div');
        detailsSection.className = 'detail-section';

        const detailsGrid = document.createElement('div');
        detailsGrid.className = 'detail-grid';

        Object.entries(result.details).forEach(([label, value]) => {
            const detailItem = document.createElement('div');
            detailItem.className = 'detail-item';
            
            const detailLabel = document.createElement('div');
            detailLabel.className = 'detail-label';
            detailLabel.textContent = label;
            
            const detailValue = document.createElement('div');
            detailValue.className = 'detail-value';
            detailValue.textContent = value;

            detailItem.appendChild(detailLabel);
            detailItem.appendChild(detailValue);
            detailsGrid.appendChild(detailItem);
        });

        detailsSection.appendChild(detailsGrid);
        card.appendChild(detailsSection);
    }

    return card;
}

function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

function clearResults() {
    document.getElementById('resultsContainer').innerHTML = '';
}

// Plot objects on the star map if coordinates are available
async function plotObjectsOnStarMap(results, query) {
    if (!window.starMap) {
        // Star map not initialized yet, wait a bit
        setTimeout(() => plotObjectsOnStarMap(results, query), 500);
        return;
    }
    
    // Clear previous plotted objects
    window.starMap.clearPlottedObjects();
    
    // Try to find coordinates for each result
    for (const result of results) {
        let ra, dec;
        
        // Check if result has coordinates
        if (result.coordinates) {
            ra = result.coordinates.ra;
            dec = result.coordinates.dec;
        } else if (result.details) {
            // Try to parse RA/Dec from details
            const raStr = result.details['Right Ascension'] || result.details['RA'];
            const decStr = result.details['Declination'] || result.details['Dec'];
            
            if (raStr && decStr) {
                ra = parseCoordinate(raStr, true);
                dec = parseCoordinate(decStr, false);
            }
        }
        
        // Check known star coordinates
        if (!ra || !dec) {
            const lowerName = result.name.toLowerCase();
            if (KNOWN_STAR_COORDINATES[lowerName]) {
                ra = KNOWN_STAR_COORDINATES[lowerName].ra;
                dec = KNOWN_STAR_COORDINATES[lowerName].dec;
            } else if (KNOWN_STAR_COORDINATES[query.toLowerCase()]) {
                ra = KNOWN_STAR_COORDINATES[query.toLowerCase()].ra;
                dec = KNOWN_STAR_COORDINATES[query.toLowerCase()].dec;
            }
        }
        
        // If we have coordinates, plot on the map
        if (ra !== undefined && dec !== undefined) {
            window.starMap.plotObject(result.name, ra, dec, result.type);
            // Only plot the first object found to avoid clutter
            break;
        }
    }
}

// Helper function to parse RA/Dec strings
function parseCoordinate(str, isRA) {
    if (!str || str === 'N/A') return undefined;
    
    // Try to extract number from string like "6.75 hours" or "6h 45m"
    const numbers = str.match(/[\d.]+/g);
    if (!numbers || numbers.length === 0) return undefined;
    
    let value = parseFloat(numbers[0]);
    
    // If it's in hours format (for RA), it's already in hours
    if (isRA && str.toLowerCase().includes('hour')) {
        return value;
    }
    
    // If it's in degrees format (for Dec), it's already in degrees
    if (!isRA && str.includes('°')) {
        return value;
    }
    
    // Try to parse hms format for RA (e.g., "6h 45m 30s")
    if (isRA && str.includes('h')) {
        const parts = str.match(/(\d+)h\s*(\d+)m/);
        if (parts) {
            value = parseFloat(parts[1]) + parseFloat(parts[2]) / 60;
            if (str.includes('s')) {
                const secMatch = str.match(/(\d+)s/);
                if (secMatch) {
                    value += parseFloat(secMatch[1]) / 3600;
                }
            }
            return value;
        }
    }
    
    return value;
}

function showNoResults(query) {
    const container = document.getElementById('resultsContainer');
    const noResults = document.createElement('div');
    noResults.className = 'no-results';
    noResults.innerHTML = `
        <h2>🔍 No Results Found</h2>
        <p>Could not find information about "${query}" in our space databases.</p>
        <p style="margin-top: 15px; font-size: 0.9rem; color: #888;">
            Try searching for: planet names, star names, asteroid numbers, exoplanet names, or galaxy names.
        </p>
    `;
    container.appendChild(noResults);
}

