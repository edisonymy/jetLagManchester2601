// Manchester B4B - Game Tracker
// Uses embedded POSTCODE_DATA from postcodes.js

// Team configuration
const TEAMS = {
    graphene: { name: 'Graphene', color: '#0a84ff', claims: 0, points: 0 },
    vimto: { name: 'Vimto', color: '#ff375f', claims: 0, points: 0 },
    program: { name: 'Program', color: '#30d158', claims: 0, points: 0 }
};

// Game state
const gameState = {
    postcodes: {},  // { name: { claims: [], lockedBy: null, polygons: [] } }
    history: [],
    events: []
};

// Map instance
let map;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadPostcodes();
    setStatus('Ready - ' + Object.keys(gameState.postcodes).length + ' regions loaded');
});

// Initialize the Leaflet map
function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView([53.48, -2.24], 12);

    // Dark style map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// Create or update SVG striped pattern for contested zones
function createOrUpdateStripePattern(postcode, color1, color2) {
    const patternId = 'stripe-' + postcode;

    // Check if SVG defs container exists, create if not
    let svgDefs = document.getElementById('svg-defs');
    if (!svgDefs) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgContainer = document.createElementNS(svgNS, 'svg');
        svgContainer.setAttribute('width', '0');
        svgContainer.setAttribute('height', '0');
        svgContainer.style.position = 'absolute';
        svgContainer.id = 'svg-container';

        svgDefs = document.createElementNS(svgNS, 'defs');
        svgDefs.id = 'svg-defs';
        svgContainer.appendChild(svgDefs);
        document.body.insertBefore(svgContainer, document.body.firstChild);
    }

    // Remove existing pattern if it exists
    const existing = document.getElementById(patternId);
    if (existing) existing.remove();

    // Create new striped pattern
    const svgNS = 'http://www.w3.org/2000/svg';
    const pattern = document.createElementNS(svgNS, 'pattern');
    pattern.setAttribute('id', patternId);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '12');
    pattern.setAttribute('height', '12');
    pattern.setAttribute('patternTransform', 'rotate(45)');

    // Color 1 stripe
    const rect1 = document.createElementNS(svgNS, 'rect');
    rect1.setAttribute('x', '0');
    rect1.setAttribute('y', '0');
    rect1.setAttribute('width', '6');
    rect1.setAttribute('height', '12');
    rect1.setAttribute('fill', color1);

    // Color 2 stripe
    const rect2 = document.createElementNS(svgNS, 'rect');
    rect2.setAttribute('x', '6');
    rect2.setAttribute('y', '0');
    rect2.setAttribute('width', '6');
    rect2.setAttribute('height', '12');
    rect2.setAttribute('fill', color2);

    pattern.appendChild(rect1);
    pattern.appendChild(rect2);
    svgDefs.appendChild(pattern);
}

// Load postcodes from embedded data
function loadPostcodes() {
    if (typeof POSTCODE_DATA === 'undefined') {
        setStatus('Error: postcodes.js not loaded');
        return;
    }

    const postcodeSelect = document.getElementById('postcode-select');
    const sortedPostcodes = Object.keys(POSTCODE_DATA).sort((a, b) => {
        const numA = parseInt(a.replace('M', ''));
        const numB = parseInt(b.replace('M', ''));
        return numA - numB;
    });

    for (const name of sortedPostcodes) {
        const coordsString = POSTCODE_DATA[name];
        const polygons = parseCoordinates(coordsString);

        // Create polygon layers
        const polygonLayers = polygons.map(coords => {
            return L.polygon(coords, {
                color: 'rgba(255, 255, 255, 0.3)',
                weight: 1,
                fillColor: 'rgba(255, 255, 255, 0.1)',
                fillOpacity: 0.3
            }).addTo(map);
        });

        // Add Label
        let marker = null;
        if (polygonLayers.length > 0) {
            // Find the largest polygon by bounding box area to place the label centrally
            let bestLayer = polygonLayers[0];
            let maxArea = 0;

            polygonLayers.forEach(layer => {
                const bounds = layer.getBounds();
                const width = bounds.getEast() - bounds.getWest();
                const height = bounds.getNorth() - bounds.getSouth();
                const area = width * height;

                if (area > maxArea) {
                    maxArea = area;
                    bestLayer = layer;
                }
            });

            let center = bestLayer.getBounds().getCenter();

            // Manual offsets for confusing postcodes - carefully adjusted based on polygon geometry
            // M5: Main body is the large western area; the algorithm picks the correct largest polygon
            //     but centroid may still be off due to irregular shape - nudge toward center-west
            // M7: Main body is a long north-south strip; label should be in the middle section
            const labelOffsets = {
                'M5': { lat: 0.003, lng: 0.018 },   // A little southwest from previous
                'M7': { lat: 0.000, lng: 0.008 }    // More north
            };
            if (labelOffsets[name]) {
                center = L.latLng(
                    center.lat + labelOffsets[name].lat,
                    center.lng + labelOffsets[name].lng
                );
            }

            marker = L.marker(center, {
                icon: L.divIcon({
                    className: 'postcode-label',
                    html: name,
                    iconSize: [30, 20]
                })
            }).addTo(map);
        }

        // Store in game state
        gameState.postcodes[name] = {
            claims: [],
            claimTimes: {},
            lockedBy: null,
            polygons: polygonLayers,
            marker: marker // Save reference
        };

        // Add to dropdown
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        postcodeSelect.appendChild(option);

        // Add click handlers
        polygonLayers.forEach(polygon => {
            polygon.on('click', () => {
                document.getElementById('postcode-select').value = name;
            });
        });
    }
}

// Parse coordinate string into Leaflet-compatible format
function parseCoordinates(coordsString) {
    // Split by | for multiple polygons
    const polygonStrings = coordsString.split('|').filter(s => s.trim());

    return polygonStrings.map(polyStr => {
        // Each coordinate is: lng,lat,0
        const points = polyStr.trim().split(/\s+/);
        return points.map(point => {
            const parts = point.split(',');
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            return [lat, lng]; // Leaflet uses [lat, lng]
        }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
    }).filter(poly => poly.length > 0);
}

// Toggle Control Panel Visibility
function toggleActions() {
    const panel = document.getElementById('actionPanel');
    const toggleBtn = document.getElementById('toggleBtn');

    panel.classList.toggle('hidden');
    toggleBtn.classList.toggle('hidden');
}

// Update status bar
function setStatus(message) {
    document.getElementById('status-bar').textContent = message;
}

// Claim a postcode
function claimPostcode() {
    const team = document.getElementById('team-select').value;
    const postcode = document.getElementById('postcode-select').value;

    if (!postcode) { setStatus('Select a postcode first'); return; }

    const pc = gameState.postcodes[postcode];
    if (!pc) { setStatus('Invalid postcode'); return; }

    if (pc.lockedBy) {
        setStatus(`${postcode} is locked by ${TEAMS[pc.lockedBy].name}`);
        return;
    }

    // Add claim
    pc.claims.push(team);
    pc.claimTimes[team] = Date.now(); // Record time of claim
    TEAMS[team].claims++;
    TEAMS[team].points += 2;

    gameState.history.push({
        type: 'claim',
        team,
        postcode
    });

    updatePolygon(postcode);
    updateScoreboard();

    const msg = `${TEAMS[team].name} claimed ${postcode}`;
    logEvent(msg);
    setStatus(msg);
}

// Lock a postcode
function lockPostcode() {
    const team = document.getElementById('team-select').value;
    const postcode = document.getElementById('postcode-select').value;

    if (!postcode) { setStatus('Select a postcode first'); return; }

    const pc = gameState.postcodes[postcode];
    if (pc.lockedBy) {
        setStatus(`${postcode} is already locked by ${TEAMS[pc.lockedBy].name}`);
        return;
    }

    // Check if team has claimed it at least once
    if (!pc.claims.includes(team)) {
        setStatus(`${TEAMS[team].name} must claim ${postcode} first`);
        return;
    }

    pc.lockedBy = team;
    TEAMS[team].points += 5; // Bonus for locking

    // Kick out other teams
    const removedClaims = [];
    const claimsToRemove = pc.claims.filter(t => t !== team);

    // Deduct points from kicked teams
    claimsToRemove.forEach(t => {
        TEAMS[t].claims--;
        TEAMS[t].points -= 2; // Lost their claim points
        removedClaims.push(t);
    });

    // Reset claims to just the locking team
    // pc.claims should ideally just be one claim per team?
    // If a team claimed multiple times (bug?), this flattens it.
    // We'll keep the locking team's *most recent* claim time, or just reset claims list.
    // Let's reset claims list to just this team.
    pc.claims = [team];

    gameState.history.push({
        type: 'lock',
        team,
        postcode,
        removedClaims // Store for undo
    });

    updatePolygon(postcode);
    updateScoreboard();

    const msg = `${TEAMS[team].name} LOCKED ${postcode}!`;
    logEvent(msg);
    setStatus(msg);
}

// Update polygon appearance based on claims
function updatePolygon(postcode) {
    const pc = gameState.postcodes[postcode];
    if (!pc) return;

    let fillColor, strokeColor, fillOpacity, weight;
    let labelText = postcode;
    let dashArray = null;

    if (pc.lockedBy) {
        // Locked - Solid, Bold Border
        fillColor = TEAMS[pc.lockedBy].color;
        strokeColor = TEAMS[pc.lockedBy].color;
        fillOpacity = 0.8; // High opacity to look "Solid"
        weight = 3;
        labelText = `${postcode} 🔒`;
    } else if (pc.claims.length > 0) {
        // Claimed - Check for multiple teams
        const uniqueTeams = [...new Set(pc.claims)];

        if (uniqueTeams.length > 1) {
            // CONTESTED: Multiple teams have claims - MAXIMUM VISIBILITY
            // Count claims per team to find leading and trailing teams
            const claimCounts = {};
            pc.claims.forEach(t => claimCounts[t] = (claimCounts[t] || 0) + 1);

            const sortedTeams = Object.keys(claimCounts).sort((a, b) => {
                const countDiff = claimCounts[b] - claimCounts[a];
                if (countDiff !== 0) return countDiff;
                const timeA = pc.claimTimes[a] || 0;
                const timeB = pc.claimTimes[b] || 0;
                return timeB - timeA;
            });

            // ENHANCED CONTESTED VISUALIZATION - Leaflet compatible
            // Create a clear "battle zone" appearance that's unmistakable
            const leadColor = TEAMS[sortedTeams[0]].color;
            const secondColor = TEAMS[sortedTeams[1]].color;

            // BRIGHT WARNING FILL - unmistakable contested appearance
            // Use bright gold/orange mix to make it IMPOSSIBLE to miss
            fillColor = '#ffa500';      // Bright orange/gold - universal "warning" color
            strokeColor = '#ffff00';    // Bright yellow border
            fillOpacity = 0.6;          // Good visibility  
            weight = 3;                 // Thinner border for cleaner look
            dashArray = '8, 4';         // Subtle dash pattern

            // Show which teams are contesting: e.g. "⚔️M1 G/V⚔️"
            const teamInitials = uniqueTeams.map(t => TEAMS[t].name.charAt(0)).join('/');
            labelText = `⚔️${postcode} ${teamInitials}⚔️`;
        } else {
            // Single team claimed - transparent fill
            fillColor = TEAMS[uniqueTeams[0]].color;
            strokeColor = TEAMS[uniqueTeams[0]].color;
            fillOpacity = 0.35;  // Slightly more transparent to differentiate from contested
            weight = 2;  // Slightly thicker border for single claims
        }
    } else {
        // Unclaimed
        fillColor = 'rgba(255, 255, 255, 0.1)';
        strokeColor = 'rgba(255, 255, 255, 0.3)';
        fillOpacity = 0.3;
        weight = 1;
    }

    pc.polygons.forEach(polygon => {
        polygon.setStyle({
            fillColor,
            color: strokeColor,
            fillOpacity,
            weight,
            dashArray
        });

        // Add/remove contested-polygon class for pulsing animation
        const container = polygon.getElement();
        if (container) {
            if (pc.claims.length > 1 && [...new Set(pc.claims)].length > 1 && !pc.lockedBy) {
                container.classList.add('contested-polygon');
            } else {
                container.classList.remove('contested-polygon');
            }
        }
    });

    // Update Label Content if marker exists
    // We need to find the marker for this postcode. Leaflet doesn't link them easily back.
    // Simplest way: iterate all map layers or store marker in state.
    // Let's update loadPostcodes to store marker in state.
    if (pc.marker) {
        const iconDiv = pc.marker.getElement();
        if (iconDiv) {
            iconDiv.innerHTML = labelText;

            // Apply different styling based on state
            const uniqueTeams = [...new Set(pc.claims)];
            const isContested = uniqueTeams.length > 1 && !pc.lockedBy;

            if (pc.lockedBy) {
                iconDiv.style.color = '#fff';
                iconDiv.style.textShadow = '0 0 4px ' + TEAMS[pc.lockedBy].color;
                iconDiv.classList.remove('contested');
            } else if (isContested) {
                // Gold/yellow color for contested labels
                iconDiv.style.color = '#ffcc00';
                iconDiv.style.textShadow = '0 0 8px rgba(255, 204, 0, 0.8)';
                iconDiv.classList.add('contested');
            } else {
                iconDiv.style.color = 'rgba(255, 255, 255, 0.7)';
                iconDiv.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
                iconDiv.classList.remove('contested');
            }
        }
    }
}

// Update scoreboard
function updateScoreboard() {
    for (const [id, team] of Object.entries(TEAMS)) {
        document.getElementById(`${id}-claims`).textContent = team.claims;
        document.getElementById(`${id}-points`).textContent = team.points;
    }
}

// Log an event
function logEvent(text) {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    gameState.events.unshift({ time, text });
    const log = document.getElementById('event-log');
    if (gameState.events.length === 1) log.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `<span class="event-time">${time}</span><span class="event-text">${text}</span>`;
    log.insertBefore(item, log.firstChild);
}

// Undo last action
function undoLastAction() {
    if (gameState.history.length === 0) {
        setStatus('Nothing to undo');
        return;
    }

    const action = gameState.history.pop();
    const pc = gameState.postcodes[action.postcode];

    if (action.type === 'claim') {
        const idx = pc.claims.lastIndexOf(action.team);
        if (idx !== -1) pc.claims.splice(idx, 1);

        TEAMS[action.team].claims--;
        TEAMS[action.team].points -= 2;
        logEvent(`Undid claim: ${action.postcode}`);

    } else if (action.type === 'lock') {
        // Unlock
        pc.lockedBy = null;
        TEAMS[action.team].points -= 5;

        // Restore removed claims
        if (action.removedClaims) {
            action.removedClaims.forEach(t => {
                pc.claims.push(t);
                TEAMS[t].claims++;
                TEAMS[t].points += 2;
            });
        }

        logEvent(`Undid lock: ${action.postcode}`);
    }

    updatePolygon(action.postcode);
    updateScoreboard();
    setStatus('Action undone');
}

// Reset game
function resetGame() {
    if (!confirm('Reset all claims and scores?')) return;

    // Reset teams
    for (const team of Object.values(TEAMS)) {
        team.claims = 0;
        team.points = 0;
    }

    // Reset postcodes
    for (const [name, pc] of Object.entries(gameState.postcodes)) {
        pc.claims = [];
        pc.claimTimes = {};
        pc.lockedBy = null;
        updatePolygon(name);
    }

    // Reset history and events
    gameState.history = [];
    gameState.events = [];
    document.getElementById('event-log').innerHTML = '<div class="empty-state">No events yet</div>';

    updateScoreboard();
    setStatus('Game reset');
}
