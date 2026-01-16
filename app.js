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
    
    // SIMBAD - for stars, galaxies, and deep-sky objects
    SIMBAD: 'http://simbad.cds.unistra.fr/simbad/sim-id',
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
            searchSIMBAD(query),         // Stars, Galaxies, Deep-Sky
        ]);

        const successfulResults = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)
            .flat();

        hideLoading();

        if (successfulResults.length === 0) {
            showNoResults(query);
        } else {
            displayResults(successfulResults);
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
        if (!response.ok) throw new Error('SBDB API error');
        
        const data = await response.json();
        if (!data || data.code !== '200' || !data.object) return null;

        const obj = data.object;
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
        };
    } catch (error) {
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
            if (!response.ok) return null;
            
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
        return null;
    }
}

// Search SIMBAD (stars, galaxies, deep-sky objects)
async function searchSIMBAD(query) {
    try {
        // SIMBAD requires specific format, so we'll use a simpler approach
        // Note: SIMBAD CORS might block direct browser requests
        // This is a placeholder that would work with a proxy
        const response = await fetch(`${API_ENDPOINTS.SIMBAD}?output.format=JSON&Ident=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            // Fallback: Create a structured result based on common knowledge
            return createFallbackResult(query);
        }

        const data = await response.json();
        if (!data || !data.id) return createFallbackResult(query);

        return {
            name: data.id,
            type: 'Celestial Object',
            source: 'SIMBAD',
            details: {
                'Object Type': data.otype_txt || 'N/A',
                'Right Ascension': data.coo?.split(' ')[0] || 'N/A',
                'Declination': data.coo?.split(' ')[1] || 'N/A',
            },
        };
    } catch (error) {
        return createFallbackResult(query);
    }
}

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

