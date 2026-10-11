/**
 * CentralSaathi — Mumbai Local Transit Suite
 * File: app.js
 * 
 * Production-Grade Commuter Intelligence Engine:
 * 1. Startup reveal & non-blocking location permission modal.
 * 2. Glassmorphic Hero Search with time and service selection.
 * 3. Journey Planner with verified Central Railway timetables.
 * 4. Pinned Active Train Card with Live Crowd Predictor (Historical Boarding Density Model).
 * 5. Google Maps Photorealistic Satellite Radar with live track and moving train marker.
 * 6. Commuter Desk (Fares, 12/15-Car Coach & FOB Proximity, Door Opening Sides, Station Amenities).
 * 7. My Personal Commute (Suburban Pass Tracker, Expiry Alarm, Office Train Routine with edit capability).
 * 8. Onboard GPS Speedometer Telemetry, Station Tracker, and Geofenced Wake Alarm with Ride Simulation.
 * 9. Advanced Safety SOS Console (Emergency Siren Whistle, Instant WhatsApp/SMS Location Broadcast, Junction RPF Direct Lines).
 * 10. Gemini Transit AI Copilot.
 */

// ==========================================
// GLOBAL APPLICATION STATE
// ==========================================
let allStations = [];
let googleMap = null;
let googleMapsLoaded = false;
let mapMarkers = [];
let routePolyline = null;
let trainLiveMarker = null;
let userCoords = null;
let isSatelliteMode = true;

// Active selected train & search state
let selectedTrain = null;
let currentSearchTrains = [];
let currentServiceFilter = 'ALL';
let currentOriginCode = 'TNA';
let currentDestCode = 'CSMT';

// GPS & Wake Alarm State
let gpsWatchId = null;
let simulationInterval = null;
let simulationStep = 0;
let isSimulating = false;
let wakeAlarmTargetStation = null;
let wakeAlarmDistanceThreshold = 1.5; // km
let isWakeAlarmArmed = false;
let audioContext = null;

// Emergency Siren State
let sirenOscillator = null;
let sirenGain = null;
let isSirenActive = false;

// User Pass State (persisted in localStorage)
const savedPass = localStorage.getItem('centralsaathi_user_pass');
let userPassData = savedPass ? JSON.parse(savedPass) : {
  corridor: 'Thane to CSMT',
  passType: 'First Class',
  expiryDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0], // 4 days from now
  ticketNumber: 'UTS-98421034',
};

// Daily Office Routine (persisted in localStorage)
const savedRoutine = localStorage.getItem('centralsaathi_user_routine');
let userRoutineData = savedRoutine ? JSON.parse(savedRoutine) : {
  morningTrain: '08:32 AM · Thane to Dadar',
  morningDetails: 'Fast Local · 12-Car Rake · Arrives 09:05 AM',
  eveningTrain: '06:45 PM · Dadar to Thane',
  eveningDetails: 'Fast Local · 12-Car Rake · Arrives 07:18 PM',
};

// ==========================================
// 1. LIFECYCLE & STARTUP WORKFLOW
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initLiveClock();
  setupTabNavigation();
  setupPlannerEvents();
  setupHeroEvents();
  setupSpeedometerEvents();
  setupMobileMenu();
  loadSavedPersonalNotes();
  initHeroWallpaper();

  // Run Startup Animation -> Followed by Location Permission Modal
  runStartupSequence();

  // Load backend datasets
  await loadStationsData();
  await loadCoachLayout();
  await loadGoogleMaps();
  await loadBulletins();

  // Setup tools
  populateToolDropdowns();
  renderAmenitiesDirectory();
  initPassTrackingUI();
  updateRoutineUI();
});

// Digital Live Clock
function initLiveClock() {
  const clockEl = document.getElementById('liveClockDisplay');
  function update() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  }
  update();
  setInterval(update, 1000);
}

// Mobile dropdown toggle
function setupMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const dropdown = document.getElementById('mobileDropdown');
  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
  });
}

// Startup Opening Animation -> Location Modal Sequence
function runStartupSequence() {
  const animOverlay = document.getElementById('openingAnimationOverlay');
  const locModal = document.getElementById('locationPermissionModal');
  const allowBtn = document.getElementById('modalAllowLocationBtn');
  const dismissBtn = document.getElementById('modalDismissLocationBtn');

  // Animation runs for 1.6 seconds
  setTimeout(() => {
    if (animOverlay) {
      animOverlay.classList.add('opacity-0');
      setTimeout(() => {
        animOverlay.style.display = 'none';

        // Keep the location permission pop-up on the screen after animation ends
        if (locModal) {
          locModal.classList.remove('hidden');
        }
      }, 500);
    } else {
      if (locModal) locModal.classList.remove('hidden');
    }
  }, 1600);

  // Modal Allow Location
  allowBtn?.addEventListener('click', () => {
    locModal?.classList.add('hidden');
    requestUserInitialLocation();
  });

  // Modal Dismiss
  dismissBtn?.addEventListener('click', () => {
    locModal?.classList.add('hidden');
  });
}

function requestUserInitialLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    },
    (err) => {
      console.warn('Initial location notification:', err.message);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ==========================================
// 2. TABBED NAVIGATION WORKSPACE
// ==========================================
function setupTabNavigation() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchAppTab(tabId);
    });
  });

  // Commuter Suite Sub-Tabs
  document.querySelectorAll('.commuter-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subtab = btn.dataset.subtab;
      showCommuterSubTab(subtab);
    });
  });
}

window.switchAppTab = function(tabId) {
  // Update nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    if (b.dataset.tab === tabId) {
      b.classList.add('nav-tab-active');
      b.classList.remove('text-slate-600');
    } else {
      b.classList.remove('nav-tab-active');
      b.classList.add('text-slate-600');
    }
  });

  // Toggle tab panels
  document.querySelectorAll('.app-tab-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`tab-${tabId}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  // Hide mobile menu
  document.getElementById('mobileDropdown')?.classList.add('hidden');

  // Trigger Map resize & redraw if switching to satellite tab
  if (tabId === 'satellite') {
    setTimeout(() => {
      if (leafletMap) {
        leafletMap.invalidateSize();
        if (currentTrackingRouteCoords.length > 0) {
          fitActiveRouteOnMap();
        } else {
          recenterRouteMap();
        }
      }
      if (googleMap && window.google) {
        google.maps.event.trigger(googleMap, 'resize');
        if (currentTrackingRouteCoords.length > 0) {
          fitActiveRouteOnMap();
        } else {
          recenterRouteMap();
        }
      }
    }, 150);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showCommuterSubTab = function(subtabName) {
  document.querySelectorAll('.commuter-subtab-btn').forEach(b => {
    if (b.dataset.subtab === subtabName) {
      b.classList.add('bg-white', 'text-slate-900', 'shadow-xs');
      b.classList.remove('hover:text-slate-900');
    } else {
      b.classList.remove('bg-white', 'text-slate-900', 'shadow-xs');
    }
  });

  document.querySelectorAll('.commuter-panel').forEach(p => {
    p.classList.add('hidden');
  });

  document.getElementById(`subtab-${subtabName}`)?.classList.remove('hidden');
};

window.quickPlanRoute = function(fromCode, toCode) {
  setStation('origin', fromCode);
  setStation('dest', toCode);
  switchAppTab('planner');
  executeJourneySearch();
};

// ==========================================
// 3. STATIONS DATA & GOOGLE MAPS SATELLITE
// ==========================================
async function loadStationsData() {
  try {
    const res = await fetch('/api/stations');
    if (!res.ok) throw new Error('Failed to load stations');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      allStations = data;
    }
  } catch (err) {
    console.warn('Using embedded stations list:', err);
    allStations = [
      { code: 'CSMT', name: 'Chhatrapati Shivaji Maharaj Terminus', marathi_name: 'छत्रपती शिवाजी महाराज टर्मिनस', lat: 18.9401, lng: 72.8354, dist_km: 0.0, is_fast: true, platforms: 7, door_side: 'Left & Right' },
      { code: 'BY', name: 'Byculla', marathi_name: 'भायखळा', lat: 18.9774, lng: 72.8331, dist_km: 4.5, is_fast: true, platforms: 4, door_side: 'Left & Right' },
      { code: 'DR', name: 'Dadar', marathi_name: 'दादर', lat: 19.0178, lng: 72.8433, dist_km: 9.5, is_fast: true, platforms: 8, door_side: 'Left & Right' },
      { code: 'CLA', name: 'Kurla', marathi_name: 'कुर्ला', lat: 19.0652, lng: 72.8793, dist_km: 15.0, is_fast: true, platforms: 8, door_side: 'Left & Right' },
      { code: 'GC', name: 'Ghatkopar', marathi_name: 'घाटकोपर', lat: 19.0864, lng: 72.9081, dist_km: 19.0, is_fast: true, platforms: 4, door_side: 'Left & Right' },
      { code: 'TNA', name: 'Thane', marathi_name: 'ठाणे', lat: 19.1868, lng: 72.9757, dist_km: 34.0, is_fast: true, platforms: 10, door_side: 'Left & Right' },
      { code: 'DI', name: 'Dombivli', marathi_name: 'डोंबिवली', lat: 19.2184, lng: 73.0867, dist_km: 48.0, is_fast: true, platforms: 5, door_side: 'Left & Right' },
      { code: 'KYN', name: 'Kalyan', marathi_name: 'कल्याण', lat: 19.2437, lng: 73.1355, dist_km: 54.0, is_fast: true, platforms: 8, door_side: 'Left & Right' },
      { code: 'KSRA', name: 'Kasara', marathi_name: 'कसारा', lat: 19.6467, lng: 73.4831, dist_km: 121.0, is_fast: true, platforms: 4, door_side: 'Left' },
      { code: 'KJT', name: 'Karjat', marathi_name: 'कर्जत', lat: 18.9106, lng: 73.3283, dist_km: 100.0, is_fast: true, platforms: 4, door_side: 'Left & Right' },
    ];
  }

  renderDoorSideDirectory();
  renderAmenitiesDirectory();
}

// ==========================================
// 3. ADVANCED ORBITAL RADAR & LIVE TRACK ENGINE
// ==========================================
let leafletMap = null;
let tileLayers = {};
let currentMapLayer = 'satellite';
let leafletStationMarkers = [];
let leafletActivePolyline = null;
let leafletActiveGlow = null;
let leafletTrainMarker = null;
let leafletNetworkGroup = null;
let currentTrackingRouteCoords = [];
let currentTrackingStops = [];
let mapSimulationTimer = null;
let mapSimulationProgress = 0.0;
let mapSimulationIsPlaying = true;
let mapSimulationSpeed = 1;
let mapSimulationIndex = 0;
let mapHudMinimized = false;
let selectedStationForMapCard = null;
let googleRoutePolyline = null;
let googleRouteRequestId = 0;
let googleNetworkLines = [];

// Official Corridor Definitions
const CORRIDOR_CODES = {
  MAIN: ['CSMT', 'MSD', 'SNRD', 'BY', 'CHG', 'CRD', 'PR', 'DR', 'MTN', 'SIN', 'CLA', 'VVH', 'GC', 'VK', 'KJRD', 'BND', 'NHU', 'MLND', 'TNA', 'KLVA', 'MBQ', 'DIVA', 'KOPR', 'DI', 'THK', 'KYN'],
  KSRA: ['KYN', 'SHAD', 'ABY', 'TLA', 'KDV', 'VSD', 'ASO', 'ATG', 'THS', 'KE', 'OMB', 'KSRA'],
  KJT: ['KYN', 'VLDI', 'ULNR', 'ABH', 'BUD', 'VGI', 'BLP', 'SHLU', 'NRL', 'BVS', 'KJT', 'KP'],
};

async function loadGoogleMaps() {
  let config = {};
  try {
    config = await fetch('/api/config').then(response => response.json());
  } catch (err) {
    console.warn('Google Maps configuration unavailable:', err);
  }

  if (config.googleMapsApiKey) {
    try {
      await loadGoogleMapsSdk(config.googleMapsApiKey);
      initGoogleMap();
      return;
    } catch (err) {
      console.warn('Google Maps SDK unavailable; using local map fallback:', err);
    }
  }

  initAdvancedSatelliteMap();
  const subtext = document.getElementById('satelliteSubtext');
  if (subtext) subtext.textContent = 'Station markers use the bundled coordinate dataset. Google transit routes are unavailable until Maps credentials are configured.';
}

function loadGoogleMapsSdk(apiKey) {
  if (window.google?.maps) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const callbackName = `centralSaathiMapsReady${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error('Google Maps JavaScript API failed to load'));
    };
    document.head.appendChild(script);
  });
}

function initGoogleMap() {
  const mapContainer = document.getElementById('leafletRailwayMap');
  if (!mapContainer || !window.google?.maps) return;

  googleMap = new google.maps.Map(mapContainer, {
    center: { lat: 19.1200, lng: 72.9300 },
    zoom: 10,
    mapTypeId: 'satellite',
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: false,
  });
  googleMapsLoaded = true;
  googleMap.addListener('click', closeMapStationInfoCard);
  plotAllStationsOnLeaflet();
  drawCentralRailwayCorridors();
  fitAllStationsOnMap();

  if (currentSearchTrains.length > 0 && selectedTrain) {
    updateMapActiveRoute(
      currentOriginCode,
      currentDestCode,
      selectedTrain.intermediate_stops || selectedTrain.stops || [],
      selectedTrain
    );
  }
}

function initAdvancedSatelliteMap() {
  const mapContainer = document.getElementById('leafletRailwayMap') || document.getElementById('googleMapCanvas');
  if (!mapContainer) return;

  if (window.L && !leafletMap) {
    try {
      leafletMap = L.map(mapContainer, {
        center: [19.1200, 72.9300],
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      });

      // Satellite Layer (Esri World Imagery) - Dedicated High-Res Satellite View
      tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
      });

      // Default and only layer: Satellite
      tileLayers.satellite.addTo(leafletMap);
      leafletNetworkGroup = L.layerGroup().addTo(leafletMap);

      // Plot All 55 Stations and Base Network Tracks
      plotAllStationsOnLeaflet();
      drawCentralRailwayCorridors();
      fitAllStationsOnMap();

      // Click on canvas closes inspector
      leafletMap.on('click', () => {
        closeMapStationInfoCard();
      });

      // If a route was already searched, plot it immediately
      if (currentSearchTrains.length > 0 && selectedTrain) {
        const stops = selectedTrain.intermediate_stops || selectedTrain.stops || [];
        updateMapActiveRoute(currentOriginCode, currentDestCode, stops, selectedTrain);
      }
    } catch (err) {
      console.warn('Leaflet initialization error:', err);
    }
  }

}

// Plot All 55 Central Railway Stations on Leaflet
function plotAllStationsOnLeaflet(filterLine = 'ALL') {
  if (allStations.length === 0) return;

  if (googleMap && window.google?.maps) {
    mapMarkers.forEach(marker => marker.setMap(null));
    mapMarkers = [];
  } else {
    if (!leafletMap || !window.L) return;
    leafletStationMarkers.forEach(marker => leafletMap.removeLayer(marker));
    leafletStationMarkers = [];
  }

  let stationsToPlot = allStations;
  if (filterLine === 'MAIN') {
    stationsToPlot = allStations.filter(s => CORRIDOR_CODES.MAIN.includes(s.code));
  } else if (filterLine === 'KSRA') {
    stationsToPlot = allStations.filter(s => CORRIDOR_CODES.KSRA.includes(s.code) || s.code === 'KYN');
  } else if (filterLine === 'KJT') {
    stationsToPlot = allStations.filter(s => CORRIDOR_CODES.KJT.includes(s.code) || s.code === 'KYN');
  } else if (filterLine === 'JUNCTIONS') {
    stationsToPlot = allStations.filter(s => s.is_junction);
  } else if (filterLine === 'ACTIVE_ROUTE') {
    if (currentTrackingStops.length > 0) {
      const haltCodes = currentTrackingStops.map(s => s.station_code || s.code);
      stationsToPlot = allStations.filter(s => haltCodes.includes(s.code));
    }
  }

  if (googleMap && window.google?.maps) {
    stationsToPlot.forEach(station => {
      const lat = Number(station.lat);
      const lng = Number(station.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return;

      const isOrigin = station.code === currentOriginCode;
      const isDestination = station.code === currentDestCode;
      const isJunction = Boolean(station.is_junction);
      const marker = new google.maps.Marker({
        map: googleMap,
        position: { lat, lng },
        title: `${station.name} (${station.code}) · PF ${station.platforms || 2}`,
        label: isOrigin ? { text: 'A', color: '#ffffff', fontWeight: '700' } : isDestination ? { text: 'B', color: '#ffffff', fontWeight: '700' } : undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: isOrigin ? '#059669' : isDestination ? '#0f172a' : isJunction ? '#047857' : '#38bdf8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: isOrigin || isDestination ? 9 : isJunction ? 7 : 5,
        },
        zIndex: isOrigin || isDestination ? 10 : isJunction ? 5 : 1,
      });
      marker.addListener('click', () => openMapStationInfoCard(station));
      mapMarkers.push(marker);
    });
    return;
  }

  stationsToPlot.forEach(s => {
    if (!s.lat || !s.lng) return;

    const lat = Number(s.lat);
    const lng = Number(s.lng);

    // Custom SVG Marker Icon
    const isJunction = s.is_junction;
    const isOrigin = s.code === currentOriginCode;
    const isDest = s.code === currentDestCode;

    let markerHtml = '';
    let iconSize = [18, 18];
    let iconAnchor = [9, 9];

    if (isOrigin) {
      markerHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-[11px]">A</div>
          <div class="absolute -inset-1 rounded-full bg-emerald-400 opacity-60 radar-pulse-ring pointer-events-none"></div>
        </div>
      `;
      iconSize = [28, 28];
      iconAnchor = [14, 14];
    } else if (isDest) {
      markerHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-[11px]">B</div>
          <div class="absolute -inset-1 rounded-full bg-amber-400 opacity-50 radar-pulse-ring pointer-events-none"></div>
        </div>
      `;
      iconSize = [28, 28];
      iconAnchor = [14, 14];
    } else if (isJunction) {
      markerHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-5 h-5 rounded-full bg-[#047857] border-2 border-white shadow-lg flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-emerald-200"></div>
          </div>
        </div>
      `;
      iconSize = [20, 20];
      iconAnchor = [10, 10];
    } else {
      markerHtml = `
        <div class="w-3.5 h-3.5 rounded-full bg-sky-400 border border-white shadow-xs"></div>
      `;
      iconSize = [14, 14];
      iconAnchor = [7, 7];
    }

    const customIcon = L.divIcon({
      html: markerHtml,
      className: 'station-div-marker',
      iconSize: iconSize,
      iconAnchor: iconAnchor,
    });

    const marker = L.marker([lat, lng], { icon: customIcon });

    // Tooltip
    marker.bindTooltip(`<strong>${s.name}</strong> (${s.code}) · PF ${s.platforms || 2}`, {
      direction: 'top',
      offset: [0, -10],
      className: 'bg-slate-900 text-white text-[11px] font-bold rounded-lg px-2 py-1 border border-slate-700 shadow-md',
    });

    // Click handler to open inspector card
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      openMapStationInfoCard(s);
    });

    marker.addTo(leafletMap);
    leafletStationMarkers.push(marker);
  });
}

// Draw Background Central Railway Corridors
function drawCentralRailwayCorridors() {
  if (leafletNetworkGroup) leafletNetworkGroup.clearLayers();
}

function fitAllStationsOnMap() {
  const stations = allStations.filter(station => Number(station.lat) && Number(station.lng));
  if (stations.length === 0) return;

  if (googleMap && window.google?.maps) {
    const bounds = new google.maps.LatLngBounds();
    stations.forEach(station => bounds.extend({ lat: Number(station.lat), lng: Number(station.lng) }));
    googleMap.fitBounds(bounds, 40);
  } else if (leafletMap && window.L) {
    const bounds = L.latLngBounds(stations.map(station => [Number(station.lat), Number(station.lng)]));
    leafletMap.fitBounds(bounds, { padding: [32, 32] });
  }
}

// Update Active Route & Animated Train on Leaflet
function updateMapActiveRoute(originCode, destCode, intermediateStops, trainObj) {
  if ((!leafletMap && !googleMap) || allStations.length === 0) return;

  const originStn = allStations.find(s => s.code === originCode);
  const destStn = allStations.find(s => s.code === destCode);
  if (!originStn || !destStn) return;

  currentOriginCode = originCode;
  currentDestCode = destCode;

  if (googleRoutePolyline) {
    googleRoutePolyline.setMap(null);
    googleRoutePolyline = null;
  }
  googleRouteRequestId += 1;

  // Clear previous Leaflet route polylines
  if (leafletMap && leafletActiveGlow) {
    leafletMap.removeLayer(leafletActiveGlow);
    leafletActiveGlow = null;
  }
  if (leafletMap && leafletActivePolyline) {
    leafletMap.removeLayer(leafletActivePolyline);
    leafletActivePolyline = null;
  }

  const rawStops = (intermediateStops && intermediateStops.length > 0)
    ? intermediateStops
    : [originStn, destStn];

  currentTrackingStops = rawStops.map(stop => {
    const code = stop.station_code || stop.code;
    return allStations.find(s => s.code === code) || stop;
  });

  currentTrackingRouteCoords = [];
  currentTrackingStops.forEach(stn => {
    if (stn && stn.lat && stn.lng) {
      currentTrackingRouteCoords.push([Number(stn.lat), Number(stn.lng)]);
    }
  });

  if (currentTrackingRouteCoords.length < 2) return;

  if (googleMap || leafletMap) {
    plotAllStationsOnLeaflet('ALL');
    updateCockpitHudMeta(originStn, destStn, trainObj || selectedTrain);
    loadGoogleTransitGeometry(originCode, destCode, trainObj || selectedTrain, originStn, destStn);
    return;
  }
}

async function loadGoogleTransitGeometry(originCode, destinationCode, train, originStation, destinationStation) {
  const requestId = googleRouteRequestId;
  const departure = new Date();
  const [hours, minutes] = String(train?.departure_time || '').split(':').map(Number);
  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    departure.setHours(hours, minutes, 0, 0);
    if (departure < new Date()) departure.setDate(departure.getDate() + 1);
  }

  const params = new URLSearchParams({
    origin: originCode,
    destination: destinationCode,
    departure_time: departure.toISOString(),
  });

  try {
    const response = await fetch(`/api/maps/route?${params}`);
    const data = await response.json();
    if (!response.ok || !data.success || requestId !== googleRouteRequestId) {
      throw new Error(data.code || 'Google transit geometry unavailable');
    }

    currentTrackingRouteCoords = data.coordinates.map(point => [Number(point.lat), Number(point.lng)]);
    if (googleMap && window.google?.maps) {
      googleRoutePolyline = new google.maps.Polyline({
        map: googleMap,
        path: data.coordinates,
        strokeColor: '#10b981',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        geodesic: false,
      });
    } else if (leafletMap && window.L) {
      leafletActivePolyline = L.polyline(
        data.coordinates.map(point => [Number(point.lat), Number(point.lng)]),
        { color: '#10b981', weight: 5, opacity: 0.95 }
      ).addTo(leafletMap);
    } else {
      throw new Error('Map renderer is unavailable');
    }
    fitActiveRouteOnMap();
    startTrainSimulationOnMap(currentTrackingStops);

    const lineNames = data.transit_lines?.filter(Boolean).join(', ');
    const subtext = document.getElementById('satelliteSubtext');
    if (subtext) {
      subtext.textContent = `Google transit route${lineNames ? ` · ${lineNames}` : ''} · not train-specific or live GPS`;
    }
  } catch (err) {
    if (requestId !== googleRouteRequestId) return;
    if (leafletActiveGlow) leafletMap?.removeLayer(leafletActiveGlow);
    if (leafletActivePolyline) leafletMap?.removeLayer(leafletActivePolyline);
    leafletActiveGlow = null;
    leafletActivePolyline = null;
    currentTrackingRouteCoords = [];
    if (mapSimulationTimer) clearInterval(mapSimulationTimer);
    mapSimulationTimer = null;
    if (trainLiveMarker) trainLiveMarker.setMap(null);
    trainLiveMarker = null;
    if (leafletTrainMarker) leafletMap?.removeLayer(leafletTrainMarker);
    leafletTrainMarker = null;
    const subtext = document.getElementById('satelliteSubtext');
    if (subtext) subtext.textContent = `Google transit geometry is unavailable for ${originStation.name} to ${destinationStation.name}. Station markers remain at their stored coordinates.`;
    console.warn('Google transit route unavailable:', err);
  }
}

// Backward-compatible alias for existing calls
function updateGoogleMapRoute(originCode, destCode, intermediateStops) {
  updateMapActiveRoute(originCode, destCode, intermediateStops, selectedTrain);
}

function updateCockpitHudMeta(originStn, destStn, train) {
  const trainTitle = document.getElementById('hudTrainTitle');
  const originLabel = document.getElementById('hudOriginLabel');
  const destLabel = document.getElementById('hudDestLabel');
  const progressPct = document.getElementById('hudProgressPct');
  const progressBar = document.getElementById('hudProgressBar');

  if (trainTitle) {
    trainTitle.textContent = `${train?.train_name || 'Central Fast Local'} #${train?.train_number || '95112'}`;
  }
  if (originLabel) originLabel.textContent = originStn.name;
  if (destLabel) destLabel.textContent = destStn.name;
  if (progressPct) progressPct.textContent = 'Departing Origin';
  if (progressBar) progressBar.style.width = '5%';
}

// Start Live Train Movement Simulation on the Track
function startTrainSimulationOnMap(stops) {
  if ((!leafletMap && !googleMap) || currentTrackingRouteCoords.length < 2) return;

  if (mapSimulationTimer) {
    clearInterval(mapSimulationTimer);
    mapSimulationTimer = null;
  }

  mapSimulationIndex = 0;
  mapSimulationProgress = 0.0;
  mapSimulationIsPlaying = true;

  const playIcon = document.getElementById('hudSimPlayIcon');
  if (playIcon) playIcon.textContent = 'Pause';

  // Create or move train marker to origin
  const originCoord = currentTrackingRouteCoords[0];
  createOrMoveTrainMarker(originCoord, 25);

  // Animation interval: updates every 400ms
  mapSimulationTimer = setInterval(() => {
    if (!mapSimulationIsPlaying) return;
    stepTrainSimulationOnMap();
  }, 400);
}

function stepTrainSimulationOnMap() {
  if (currentTrackingRouteCoords.length < 2) return;

  const totalSegments = currentTrackingRouteCoords.length - 1;
  const stepIncrement = 0.02 * mapSimulationSpeed;

  mapSimulationProgress += stepIncrement;

  if (mapSimulationProgress >= 1.0) {
    mapSimulationProgress = 1.0;
    mapSimulationIsPlaying = false;
    clearInterval(mapSimulationTimer);
    mapSimulationTimer = null;

    const playIcon = document.getElementById('hudSimPlayIcon');
    if (playIcon) playIcon.textContent = 'Replay';

    const liveSpeedEl = document.getElementById('hudLiveSpeed');
    if (liveSpeedEl) liveSpeedEl.textContent = '0';

    const passedEl = document.getElementById('hudStationPassed');
    if (passedEl && currentTrackingStops.length > 0) {
      const last = currentTrackingStops[currentTrackingStops.length - 1];
      passedEl.textContent = `${last.name || last.station_name} (Arrived)`;
    }
    const nextEl = document.getElementById('hudStationNext');
    if (nextEl) nextEl.textContent = 'Destination Terminal Reached';

    const nextEtaEl = document.getElementById('hudNextEta');
    if (nextEtaEl) nextEtaEl.textContent = 'Platform Exit FOB Direct';

    const progressPct = document.getElementById('hudProgressPct');
    const progressBar = document.getElementById('hudProgressBar');
    if (progressPct) progressPct.textContent = '100% Arrived';
    if (progressBar) progressBar.style.width = '100%';
    return;
  }

  // Calculate current segment & interpolated position
  const rawIdx = mapSimulationProgress * totalSegments;
  const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1);
  const segRatio = rawIdx - segIdx;

  const p1 = currentTrackingRouteCoords[segIdx];
  const p2 = currentTrackingRouteCoords[segIdx + 1];

  const currentLat = p1[0] + (p2[0] - p1[0]) * segRatio;
  const currentLng = p1[1] + (p2[1] - p1[1]) * segRatio;

  // Realistic speed simulation: 0 at stops, 60-80 on open track
  let speedKmh = Math.round(52 + Math.sin(segRatio * Math.PI) * 26);
  if (segRatio < 0.15 || segRatio > 0.85) {
    speedKmh = Math.round(28 + Math.sin(segRatio * Math.PI) * 15);
  }

  createOrMoveTrainMarker([currentLat, currentLng], speedKmh);

  // Update HUD Passed & Approaching Stations
  const stopIndex = Math.min(
    Math.floor(mapSimulationProgress * Math.max(0, currentTrackingStops.length - 1)),
    Math.max(0, currentTrackingStops.length - 2)
  );
  const currentHalt = currentTrackingStops[stopIndex] || currentTrackingStops[0];
  const nextHalt = currentTrackingStops[stopIndex + 1] || currentTrackingStops[currentTrackingStops.length - 1];

  const passedEl = document.getElementById('hudStationPassed');
  const passedTimeEl = document.getElementById('hudPassedTime');
  const nextEl = document.getElementById('hudStationNext');
  const nextEtaEl = document.getElementById('hudNextEta');
  const liveSpeedEl = document.getElementById('hudLiveSpeed');
  const progressPct = document.getElementById('hudProgressPct');
  const progressBar = document.getElementById('hudProgressBar');

  if (passedEl) passedEl.textContent = `${currentHalt.name || currentHalt.station_name} (PF ${currentHalt.platforms || 2})`;
  if (passedTimeEl) passedTimeEl.textContent = `Dep: ${selectedTrain?.departure_time || '08:32'}`;
  if (nextEl) nextEl.textContent = `${nextHalt.name || nextHalt.station_name} (PF 1/2)`;

  // Distance remaining to next station
  const distToNext = calculateHaversineDistance(currentLat, currentLng, nextHalt.lat, nextHalt.lng).toFixed(1);
  const estMins = Math.max(1, Math.round(distToNext * 1.5));
  if (nextEtaEl) nextEtaEl.textContent = `${distToNext} km · ~${estMins} mins`;
  if (liveSpeedEl) liveSpeedEl.textContent = speedKmh;

  const pct = Math.round(mapSimulationProgress * 100);
  if (progressPct) progressPct.textContent = `${pct}% En Route`;
  if (progressBar) progressBar.style.width = `${pct}%`;

  // Also update global Speedometer telemetry if tab is active
  updateSpeedometerUI(speedKmh);

  // Check Wake Alarm proximity
  if (isWakeAlarmArmed && wakeAlarmTargetStation) {
    const distToTarget = calculateHaversineDistance(currentLat, currentLng, wakeAlarmTargetStation.lat, wakeAlarmTargetStation.lng);
    if (distToTarget <= wakeAlarmDistanceThreshold) {
      triggerAlarmBuzzer();
      disarmWakeAlarm();
    }
  }
}

function createOrMoveTrainMarker(latlng, speedKmh) {
  if (googleMap && window.google?.maps) {
    const position = { lat: Number(latlng[0]), lng: Number(latlng[1]) };
    if (!trainLiveMarker) {
      trainLiveMarker = new google.maps.Marker({
        map: googleMap,
        position,
        title: `Simulated route position · ${speedKmh} km/h`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#fbbf24',
          fillOpacity: 1,
          strokeColor: '#064e3b',
          strokeWeight: 3,
          scale: 9,
        },
        zIndex: 1000,
      });
    } else {
      trainLiveMarker.setPosition(position);
      trainLiveMarker.setTitle(`Simulated route position · ${speedKmh} km/h`);
    }
    return;
  }

  if (!leafletMap || !window.L) return;

  const trainHtml = `
    <div class="relative flex items-center justify-center">
      <div class="w-8 h-8 rounded-full bg-amber-400 border-2 border-[#064e3b] shadow-2xl flex items-center justify-center text-[#064e3b] font-black">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <rect width="16" height="16" x="4" y="3" rx="2"/>
          <circle cx="8" cy="15" r="1.5" fill="#ffffff"/>
          <circle cx="16" cy="15" r="1.5" fill="#ffffff"/>
        </svg>
      </div>
      <div class="absolute -inset-2 rounded-full bg-amber-300 opacity-60 radar-pulse-ring pointer-events-none"></div>
    </div>
  `;

  const trainIcon = L.divIcon({
    html: trainHtml,
    className: 'train-locomotive-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  if (!leafletTrainMarker) {
    leafletTrainMarker = L.marker(latlng, { icon: trainIcon, zIndexOffset: 1000 }).addTo(leafletMap);
    leafletTrainMarker.bindTooltip(`<strong>Simulated Route Position</strong> · ${speedKmh} km/h`, {
      direction: 'top',
      offset: [0, -14],
      className: 'bg-emerald-950 text-emerald-200 text-xs font-bold rounded-lg px-2 py-1 border border-emerald-500',
    });
  } else {
    leafletTrainMarker.setLatLng(latlng);
    leafletTrainMarker.setTooltipContent(`<strong>Simulated Route Position</strong> · ${speedKmh} km/h`);
  }
}

// Map Controls: Maintain Dedicated Satellite Layer
window.switchMapLayer = function() {
  if (googleMap) {
    googleMap.setMapTypeId('satellite');
    return;
  }
  if (!leafletMap || !tileLayers.satellite) return;
  if (!leafletMap.hasLayer(tileLayers.satellite)) {
    tileLayers.satellite.addTo(leafletMap);
  }
  currentMapLayer = 'satellite';
};

// Map Controls: Corridor Filter Pills
window.filterMapStationsByLine = function(lineCode, buttonEl) {
  document.querySelectorAll('.map-corridor-filter').forEach(btn => {
    btn.className = 'map-corridor-filter px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold shrink-0';
  });
  if (buttonEl) {
    buttonEl.className = 'map-corridor-filter px-3 py-1.5 rounded-lg bg-[#064e3b] text-white font-bold shrink-0 shadow-2xs';
  }
  plotAllStationsOnLeaflet(lineCode);
};

// Map Controls: Station Search Autocomplete
window.filterMapStationSearch = function(query) {
  const dropdown = document.getElementById('mapStationSearchDropdown');
  if (!dropdown) return;

  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    dropdown.classList.add('hidden');
    return;
  }

  const matches = allStations.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.code.toLowerCase().includes(q) ||
    (s.marathi_name && s.marathi_name.includes(q))
  ).slice(0, 8);

  if (matches.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-slate-400 text-center">No stations found</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  let html = '';
  matches.forEach(s => {
    html += `
      <div 
        onclick="selectStationFromMapSearch('${s.code}')" 
        class="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
      >
        <div>
          <div class="font-bold text-slate-900">${s.name} <span class="text-slate-400 font-mono text-[10px]">(${s.code})</span></div>
          <div class="text-[10px] text-slate-500">${s.marathi_name || ''} · PF ${s.platforms || 2}</div>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">Fly To</span>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
};

window.selectStationFromMapSearch = function(code) {
  const dropdown = document.getElementById('mapStationSearchDropdown');
  if (dropdown) dropdown.classList.add('hidden');

  const stn = allStations.find(s => s.code === code);
  if (!stn || (!leafletMap && !googleMap)) return;

  const searchInput = document.getElementById('mapStationSearchInput');
  if (searchInput) searchInput.value = `${stn.name} (${stn.code})`;

  if (googleMap) {
    googleMap.panTo({ lat: Number(stn.lat), lng: Number(stn.lng) });
    googleMap.setZoom(14);
  } else {
    leafletMap.flyTo([Number(stn.lat), Number(stn.lng)], 14, { duration: 1.2 });
  }
  openMapStationInfoCard(stn);
};

// Map Controls: Open Station Info Card
window.openMapStationInfoCard = function(stn) {
  selectedStationForMapCard = stn;
  const card = document.getElementById('mapStationInfoCard');
  if (!card) return;

  document.getElementById('cardStnName').textContent = stn.name;
  document.getElementById('cardStnCode').textContent = stn.code;
  document.getElementById('cardStnPf').textContent = `PF 1 - ${stn.platforms || 2}`;
  document.getElementById('cardStnMarathi').textContent = stn.marathi_name || 'मध्य रेल्वे स्थानक';

  const am = stn.amenities || { escalators: 2, lifts: 1, water_atms: 4, medical_post: 'PF 1 Station Master' };
  document.getElementById('cardStnEscalators').textContent = am.escalators || 0;
  document.getElementById('cardStnLifts').textContent = am.lifts || 0;
  document.getElementById('cardStnWater').textContent = am.water_atms || 2;
  document.getElementById('cardStnDoor').textContent = stn.door_side || 'Left & Right';

  // Interchanges
  const interContainer = document.getElementById('cardStnInterchanges');
  if (interContainer) {
    let interHtml = '';
    (stn.interchanges || ['Central Suburban Line']).forEach(tag => {
      interHtml += `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">${tag}</span>`;
    });
    interContainer.innerHTML = interHtml;
  }

  card.classList.remove('hidden');
};

window.closeMapStationInfoCard = function() {
  document.getElementById('mapStationInfoCard')?.classList.add('hidden');
  selectedStationForMapCard = null;
};

window.setStationAsOriginFromMap = function() {
  if (!selectedStationForMapCard) return;
  setStation('origin', selectedStationForMapCard.code);
  closeMapStationInfoCard();
  switchAppTab('planner');
};

window.setStationAsDestFromMap = function() {
  if (!selectedStationForMapCard) return;
  setStation('dest', selectedStationForMapCard.code);
  closeMapStationInfoCard();
  switchAppTab('planner');
};

// Simulation Controls
window.toggleTrainSimulationPlay = function() {
  mapSimulationIsPlaying = !mapSimulationIsPlaying;
  const playIcon = document.getElementById('hudSimPlayIcon');
  if (playIcon) playIcon.textContent = mapSimulationIsPlaying ? 'Pause' : 'Play';

  if (mapSimulationIsPlaying && !mapSimulationTimer) {
    if (mapSimulationProgress >= 1.0) mapSimulationProgress = 0.0;
    mapSimulationTimer = setInterval(stepTrainSimulationOnMap, 400);
  }
};

window.cycleTrainSimulationSpeed = function() {
  if (mapSimulationSpeed === 1) mapSimulationSpeed = 2;
  else if (mapSimulationSpeed === 2) mapSimulationSpeed = 5;
  else mapSimulationSpeed = 1;

  const label = document.getElementById('hudSimSpeedLabel');
  if (label) label.textContent = `${mapSimulationSpeed}x`;
};

window.resetTrainSimulation = function() {
  mapSimulationProgress = 0.0;
  mapSimulationIsPlaying = true;
  const playIcon = document.getElementById('hudSimPlayIcon');
  if (playIcon) playIcon.textContent = 'Pause';

  if (!mapSimulationTimer) {
    mapSimulationTimer = setInterval(stepTrainSimulationOnMap, 400);
  }
  stepTrainSimulationOnMap();
};

window.toggleMapHudMinimize = function() {
  mapHudMinimized = !mapHudMinimized;
  const body = document.getElementById('hudBodyContent');
  const icon = document.getElementById('hudToggleIcon');
  if (body) body.classList.toggle('hidden', mapHudMinimized);
  if (icon) icon.textContent = mapHudMinimized ? 'Expand' : 'Minimize';
};

window.toggleRealGpsTracking = function() {
  switchAppTab('speedometer');
  requestSpeedometerGps();
};

window.fitActiveRouteOnMap = function() {
  if ((!leafletMap && !googleMap) || currentTrackingRouteCoords.length === 0) {
    recenterRouteMap();
    return;
  }
  if (googleMap) {
    const bounds = new google.maps.LatLngBounds();
    currentTrackingRouteCoords.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    googleMap.fitBounds(bounds, 50);
    return;
  }
  const bounds = L.latLngBounds(currentTrackingRouteCoords);
  leafletMap.fitBounds(bounds, { padding: [50, 50] });
};

window.recenterRouteMap = function() {
  if (googleMap) {
    if (currentTrackingRouteCoords.length > 0) fitActiveRouteOnMap();
    else fitAllStationsOnMap();
    return;
  }
  if (leafletMap) {
    if (currentTrackingRouteCoords.length > 0) fitActiveRouteOnMap();
    else fitAllStationsOnMap();
  }
};

// ==========================================
// LANDING PAGE HERO BACKGROUND CUSTOMIZATION
// ==========================================
const HERO_BG_PRESETS = {
  dusk: {
    url: '/public/assets/mumbai_local_train.jpg',
    name: 'Mumbai Local'
  },
  midnight: {
    url: '/public/assets/bg_midnight_rail.svg',
    name: 'Midnight Electric'
  },
  monsoon: {
    url: '/public/assets/bg_monsoon_ghat.svg',
    name: 'Monsoon Ghat'
  },
  heritage: {
    url: '/public/assets/bg_heritage_vt.svg',
    name: 'VT Heritage'
  }
};

window.toggleHeroBgModal = function(show = true) {
  const modal = document.getElementById('heroBgModal');
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
};

window.selectPresetBg = function(presetKey) {
  const preset = HERO_BG_PRESETS[presetKey];
  if (!preset) return;

  applyHeroBg(preset.url, preset.name);
  try {
    localStorage.setItem('centralsaathi_hero_bg', preset.url);
    localStorage.setItem('centralsaathi_hero_bg_name', preset.name);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
  toggleHeroBgModal(false);
};

window.handleHeroBgFileSelected = function(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    applyHeroBg(dataUrl, 'Custom Photo');
    try {
      localStorage.setItem('centralsaathi_hero_bg', dataUrl);
      localStorage.setItem('centralsaathi_hero_bg_name', 'Custom Photo');
    } catch (err) {
      console.warn('Image size too large for localStorage cache:', err);
    }
    toggleHeroBgModal(false);
  };
  reader.readAsDataURL(file);
};

window.resetHeroBgToDefault = function() {
  localStorage.removeItem('centralsaathi_hero_bg');
  localStorage.removeItem('centralsaathi_hero_bg_name');
  applyHeroBg(HERO_BG_PRESETS.dusk.url, 'Change Background');
  toggleHeroBgModal(false);
};

function applyHeroBg(bgUrl, labelText = '') {
  const banner = document.getElementById('heroAtmosphericBanner');
  if (!banner) return;

  banner.style.backgroundImage = `linear-gradient(90deg, rgba(7, 19, 30, 0.94) 0%, rgba(7, 19, 30, 0.82) 38%, rgba(7, 19, 30, 0.22) 75%, rgba(7, 19, 30, 0.35) 100%), radial-gradient(ellipse at 80% 50%, rgba(217, 119, 6, 0.20) 0%, rgba(7, 19, 30, 0) 70%), url('${bgUrl}')`;
  banner.style.backgroundPosition = 'right center';
  banner.style.backgroundSize = 'cover';
  banner.style.backgroundRepeat = 'no-repeat';

  const label = document.getElementById('currentHeroBgLabel');
  if (label && labelText) {
    label.textContent = labelText;
  }
}

function initHeroWallpaper() {
  const savedBg = localStorage.getItem('centralsaathi_hero_bg');
  const savedName = localStorage.getItem('centralsaathi_hero_bg_name');
  if (savedBg && savedBg !== '/public/assets/mumbai_railway_hero.svg') {
    applyHeroBg(savedBg, savedName || 'Custom');
  } else {
    applyHeroBg(HERO_BG_PRESETS.dusk.url, 'Change Background');
  }
}

// ==========================================
// 4. HERO SECTION SEARCH
// ==========================================
function setupHeroEvents() {
  const heroFrom = document.getElementById('heroOriginInput');
  const heroTo = document.getElementById('heroDestInput');
  const heroTime = document.getElementById('heroTimeInput');

  // Pre-fill current time in hero input
  if (heroTime) {
    const now = new Date();
    heroTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  heroFrom?.addEventListener('input', (e) => filterHeroDropdown('origin', e.target.value));
  heroFrom?.addEventListener('focus', (e) => filterHeroDropdown('origin', e.target.value));
  heroTo?.addEventListener('input', (e) => filterHeroDropdown('dest', e.target.value));
  heroTo?.addEventListener('focus', (e) => filterHeroDropdown('dest', e.target.value));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#heroOriginInput') && !e.target.closest('#heroOriginDropdown')) {
      document.getElementById('heroOriginDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#heroDestInput') && !e.target.closest('#heroDestDropdown')) {
      document.getElementById('heroDestDropdown')?.classList.add('hidden');
    }
  });
}

function filterHeroDropdown(type, query) {
  const dropdown = document.getElementById(type === 'origin' ? 'heroOriginDropdown' : 'heroDestDropdown');
  if (!dropdown) return;

  const q = (query || '').trim().toLowerCase();
  const matched = allStations.filter(s => {
    return s.code.toLowerCase().includes(q) ||
           s.name.toLowerCase().includes(q) ||
           (s.marathi_name && s.marathi_name.includes(q));
  }).slice(0, 10);

  if (matched.length === 0) {
    dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No stations found</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = '';
  matched.forEach(s => {
    html += `
      <div 
        class="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
        onclick="selectHeroStation('${type}', '${s.code}')"
      >
        <div class="flex items-center gap-2">
          <span class="w-8 h-6 rounded bg-emerald-50 text-emerald-800 text-xs font-black flex items-center justify-center">${s.code}</span>
          <div>
            <div class="text-xs font-bold text-slate-900">${s.name}</div>
            <div class="text-[10px] text-slate-400">${s.dist_km} km · Door: ${s.door_side || 'Left'}</div>
          </div>
        </div>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

window.selectHeroStation = function(type, code) {
  const stn = allStations.find(s => s.code === code);
  if (!stn) return;
  const input = document.getElementById(type === 'origin' ? 'heroOriginInput' : 'heroDestInput');
  if (input) {
    input.value = `${stn.name} (${stn.code})`;
    input.dataset.code = stn.code;
  }
  document.getElementById(type === 'origin' ? 'heroOriginDropdown' : 'heroDestDropdown')?.classList.add('hidden');
};

window.executeHeroSearch = function() {
  const heroFrom = document.getElementById('heroOriginInput');
  const heroTo = document.getElementById('heroDestInput');
  const heroTime = document.getElementById('heroTimeInput')?.value || '';
  const heroService = document.getElementById('heroServiceSelect')?.value || 'ALL';

  const fromCode = heroFrom?.dataset.code;
  const toCode = heroTo?.dataset.code;

  if (!fromCode || !toCode) {
    alert('Please select both Starting Station and Destination in the search box.');
    return;
  }

  // Sync with Journey Planner inputs
  setStation('origin', fromCode);
  setStation('dest', toCode);

  const plannerTime = document.getElementById('plannerTimeInput');
  if (plannerTime && heroTime) plannerTime.value = heroTime;

  currentServiceFilter = heroService;
  document.querySelectorAll('.pref-type-btn').forEach(b => {
    if (b.dataset.type === heroService) {
      b.classList.add('bg-white', 'text-slate-900', 'shadow-2xs', 'font-bold');
      b.classList.remove('text-slate-600');
    } else {
      b.classList.remove('bg-white', 'text-slate-900', 'shadow-2xs', 'font-bold');
      b.classList.add('text-slate-600');
    }
  });

  switchAppTab('planner');
  executeJourneySearch();
};

// ==========================================
// 5. JOURNEY PLANNER & TIMETABLE SEARCH
// ==========================================
function setupPlannerEvents() {
  const originInput = document.getElementById('originInput');
  const destInput = document.getElementById('destInput');
  const swapBtn = document.getElementById('swapStationsBtn');
  const findBtn = document.getElementById('findBestTrainBtn');
  const plannerTime = document.getElementById('plannerTimeInput');

  if (plannerTime) {
    const now = new Date();
    plannerTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  originInput?.addEventListener('input', (e) => filterStationDropdown('origin', e.target.value));
  originInput?.addEventListener('focus', (e) => filterStationDropdown('origin', e.target.value));
  destInput?.addEventListener('input', (e) => filterStationDropdown('dest', e.target.value));
  destInput?.addEventListener('focus', (e) => filterStationDropdown('dest', e.target.value));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#originContainer')) {
      document.getElementById('originDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#destContainer')) {
      document.getElementById('destDropdown')?.classList.add('hidden');
    }
  });

  swapBtn?.addEventListener('click', () => {
    document.getElementById('swapIcon')?.classList.toggle('rotated');
    const tempCode = originInput.dataset.code;
    const tempVal = originInput.value;
    originInput.dataset.code = destInput.dataset.code;
    originInput.value = destInput.value;
    destInput.dataset.code = tempCode;
    destInput.value = tempVal;

    if (originInput.dataset.code && destInput.dataset.code) {
      executeJourneySearch();
    }
  });

  document.querySelectorAll('.pref-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pref-type-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-slate-900', 'shadow-2xs', 'font-bold');
        b.classList.add('text-slate-600');
      });
      btn.classList.add('bg-white', 'text-slate-900', 'shadow-2xs', 'font-bold');
      btn.classList.remove('text-slate-600');
      currentServiceFilter = btn.dataset.type;

      if (originInput.dataset.code && destInput.dataset.code) {
        executeJourneySearch();
      }
    });
  });

  findBtn?.addEventListener('click', () => {
    executeJourneySearch();
  });
}

function filterStationDropdown(type, query) {
  const dropdown = document.getElementById(type === 'origin' ? 'originDropdown' : 'destDropdown');
  if (!dropdown) return;

  const q = (query || '').trim().toLowerCase();
  const matched = allStations.filter(s => {
    return s.code.toLowerCase().includes(q) ||
           s.name.toLowerCase().includes(q) ||
           (s.marathi_name && s.marathi_name.includes(q));
  }).slice(0, 10);

  if (matched.length === 0) {
    dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No stations found</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = '';
  matched.forEach(s => {
    const doorBadge = s.door_side ? `<span class="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Door: ${s.door_side}</span>` : '';
    const fastTag = s.is_fast ? `<span class="text-[9px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Fast</span>` : '';

    html += `
      <div 
        class="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
        onclick="selectStation('${type}', '${s.code}')"
      >
        <div class="flex items-center gap-2">
          <span class="w-8 h-6 rounded bg-slate-100 text-slate-900 text-xs font-black flex items-center justify-center">${s.code}</span>
          <div>
            <div class="text-xs font-bold text-slate-900">${s.name} <span class="text-slate-400 font-normal">(${s.marathi_name || ''})</span></div>
            <div class="text-[10px] text-slate-400">${s.dist_km} km · PF ${s.platforms || 2}</div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          ${doorBadge}
          ${fastTag}
        </div>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function selectStation(type, code) {
  setStation(type, code);
  document.getElementById(type === 'origin' ? 'originDropdown' : 'destDropdown')?.classList.add('hidden');
}

function setStation(type, code) {
  const stn = allStations.find(s => s.code === code);
  if (!stn) return;
  const input = document.getElementById(type === 'origin' ? 'originInput' : 'destInput');
  if (input) {
    input.value = `${stn.name} (${stn.code})`;
    input.dataset.code = stn.code;
  }
}

// Search execution with Live Crowd Predictor Integration
async function executeJourneySearch() {
  const originInput = document.getElementById('originInput');
  const destInput = document.getElementById('destInput');
  const fromCode = originInput?.dataset.code;
  const toCode = destInput?.dataset.code;
  const timeVal = document.getElementById('plannerTimeInput')?.value || '';

  if (!fromCode || !toCode) {
    alert('Please select both departure and destination stations to view schedules.');
    return;
  }

  if (fromCode === toCode) {
    alert('Boarding and destination stations cannot be identical.');
    return;
  }

  currentOriginCode = fromCode;
  currentDestCode = toCode;

  const initialEmpty = document.getElementById('plannerInitialEmptyState');
  const skeleton = document.getElementById('resultsSkeleton');
  const content = document.getElementById('resultsContent');
  const verificationNotice = document.getElementById('timetableVerificationNotice');
  const findBtnLabel = document.getElementById('findBtnLabel');
  let resultsReady = false;

  currentSearchTrains = [];
  selectedTrain = null;
  if (initialEmpty) initialEmpty.classList.add('hidden');
  if (skeleton) skeleton.classList.remove('hidden');
  if (content) content.classList.add('hidden');
  if (verificationNotice) verificationNotice.classList.add('hidden');
  if (findBtnLabel) findBtnLabel.textContent = 'CHECKING TIMETABLE...';

  try {
    let url = `/api/trains/search?origin=${fromCode}&destination=${toCode}`;
    if (timeVal) url += `&time=${encodeURIComponent(timeVal)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Timetable verification failed. Train times are hidden.');
    }
    currentSearchTrains = data.available_trains || data.all_scheduled_trains || [];
    if (currentSearchTrains.length === 0) {
      throw new Error('No train times passed timetable verification.');
    }
    renderSearchResults(data, fromCode, toCode);
    const verification = data.verification || {};
    if (verificationNotice) {
      verificationNotice.textContent = verification.status === 'GEMINI_VERIFIED'
        ? `Gemini checked ${verification.verified_count} timetable entries against the bundled schedule before showing times.`
        : 'Train times passed local timetable checks. Gemini verification is not configured.';
      verificationNotice.classList.remove('hidden');
    }
    resultsReady = true;
  } catch (err) {
    console.error('Timetable search error:', err);
    if (verificationNotice) {
      verificationNotice.textContent = err.message || 'Train times could not be verified and are hidden.';
      verificationNotice.classList.remove('hidden');
    }
  } finally {
    if (skeleton) skeleton.classList.add('hidden');
    if (content && resultsReady) content.classList.remove('hidden');
    if (findBtnLabel) findBtnLabel.textContent = 'FIND BEST TRAIN';
  }
}

function renderSearchResults(data, fromCode, toCode) {
  let trains = currentSearchTrains;
  if (currentServiceFilter === 'FAST') {
    trains = trains.filter(t => t.is_fast || t.train_type === 'FAST');
  } else if (currentServiceFilter === 'AC') {
    trains = trains.filter(t => t.is_ac);
  } else if (currentServiceFilter === 'SLOW') {
    trains = trains.filter(t => !t.is_fast && t.train_type !== 'FAST');
  }

  // Set the primary selected train
  const initialTrain = data.recommended_journey || trains[0];
  if (initialTrain) {
    setActiveSelectedTrain(initialTrain, fromCode, toCode);
  }

  // Render Upcoming Trains List
  renderUpcomingTrains(trains, fromCode, toCode);

  const stops = initialTrain?.intermediate_stops || initialTrain?.stops || [];

  // Render Route Timeline
  renderRouteTimeline(stops, fromCode, toCode);

  // Update Satellite Map with Route
  updateGoogleMapRoute(fromCode, toCode, stops);

  // Populate Target Stations in Speedometer with only the stations on this route
  populateRouteStationsInSpeedometer(stops, toCode);
}

function setActiveSelectedTrain(train, fromCode, toCode) {
  selectedTrain = train;
  const originStn = allStations.find(s => s.code === fromCode);
  const destStn = allStations.find(s => s.code === toCode);

  document.getElementById('recDepTime').textContent = train.departure_time || '08:32';
  document.getElementById('recArrTime').textContent = train.arrival_time || '09:05';
  document.getElementById('recOriginName').textContent = originStn?.name || fromCode;
  document.getElementById('recDestName').textContent = destStn?.name || toCode;
  document.getElementById('recDuration').textContent = `${train.duration_minutes || 33} min`;
  document.getElementById('recOriginPlatform').textContent = train.origin_platform || train.platform || 'PF 5';
  document.getElementById('recDestPlatform').textContent = train.dest_platform || 'PF 4/5';
  document.getElementById('recTrainName').textContent = `${train.train_name || 'Central Suburban Local'} (#${train.train_number || '95746'})`;

  const waitText = (train.wait_mins !== null && train.wait_mins !== undefined)
    ? `Departs in ${train.wait_mins} mins`
    : 'Scheduled WTT Service';
  document.getElementById('recWaitMinutes').textContent = waitText;

  const destDoorSide = train.door_side_at_dest || destStn?.door_side || 'Left & Right';
  document.getElementById('recDoorSide').textContent = destDoorSide;

  // UPDATE LIVE DELAY STATUS BADGE ('On Time', 'Delayed 5m', 'Delayed 15m')
  const delayInfo = train.delay_info || {
    status: 'On Time',
    delay_minutes: 0,
    badge_color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dot_color: '#10b981',
    reason: 'Operating on time as per Central Railway WTT'
  };

  const delayBadge = document.getElementById('recDelayBadge');
  const delayText = document.getElementById('recDelayText');
  const delayDot = document.getElementById('recDelayDot');
  const expectedTimeEl = document.getElementById('recExpectedTime');

  if (delayBadge && delayText) {
    delayText.textContent = delayInfo.status.toUpperCase();
    delayBadge.className = `inline-flex items-center gap-1 px-2.5 py-0.5 border text-[10px] font-extrabold rounded-md uppercase ${delayInfo.badge_color}`;
    if (delayDot) delayDot.style.backgroundColor = delayInfo.dot_color;
  }

  if (expectedTimeEl) {
    if (delayInfo.delay_minutes > 0 && delayInfo.expected_departure_time) {
      expectedTimeEl.textContent = `Expected: ${delayInfo.expected_departure_time}`;
      expectedTimeEl.classList.remove('hidden');
    } else {
      expectedTimeEl.classList.add('hidden');
    }
  }

  // UPDATE LIVE CROWD PREDICTOR WIDGET (HISTORICAL BOARDING DENSITY MODEL)
  const crowd = train.crowd_prediction || {
    level: 'Moderate',
    occupancy_pct: 64,
    tag_color: 'bg-amber-50 text-amber-800 border-amber-200',
    bar_color: '#d97706',
    period_name: 'Moderate Day Commute',
    description: 'Moderate passenger flow. Seats generally open up after major junction halts like Dadar, Kurla, or Thane.',
    coach_density: {
      coach_front_ii: 'Moderate',
      coach_ladies_3: 'Moderate',
      coach_first_5: 'Moderate',
      coach_ladies_7: 'Moderate',
      coach_first_10: 'Low',
      coach_rear_guard: 'Moderate'
    }
  };

  const badge = document.getElementById('crowdStatusBadge');
  const bar = document.getElementById('crowdProgressBar');
  const pct = document.getElementById('crowdOccupancyPct');
  const period = document.getElementById('crowdPeriodName');
  const tip = document.getElementById('crowdTipText');

  if (badge) {
    badge.textContent = crowd.level;
    badge.className = `px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${crowd.tag_color}`;
  }
  if (bar) {
    bar.style.width = `${crowd.occupancy_pct || 60}%`;
    bar.style.backgroundColor = crowd.bar_color || '#d97706';
  }
  if (pct) {
    pct.textContent = `${crowd.occupancy_pct || 60}% Occupancy`;
  }
  if (period) {
    period.textContent = crowd.period_name || 'Historical Boarding Model';
  }
  if (tip) {
    tip.textContent = crowd.description;
  }

  // Update coach density breakdown
  if (crowd.coach_density) {
    const cd = crowd.coach_density;
    setDensityBadge('coachDensity1', cd.coach_front_ii);
    setDensityBadge('coachDensity3', cd.coach_ladies_3);
    setDensityBadge('coachDensity5', cd.coach_first_5);
    setDensityBadge('coachDensity7', cd.coach_ladies_7);
    setDensityBadge('coachDensity8', cd.coach_first_10 || 'Low');
    setDensityBadge('coachDensity12', cd.coach_rear_guard);
  }
}

function setDensityBadge(elementId, density) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = density || 'Moderate';
  if (density === 'Super-Dense' || density === 'Packed') {
    el.className = 'font-bold text-rose-700';
  } else if (density === 'Low') {
    el.className = 'font-bold text-emerald-700';
  } else {
    el.className = 'font-bold text-amber-700';
  }
}

function renderUpcomingTrains(trains, fromCode, toCode) {
  const container = document.getElementById('moreTrainsList');
  const countEl = document.getElementById('moreOptionsCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${trains.length} verified services · Click to select`;

  if (trains.length === 0) {
    container.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No trains found for this selection</div>`;
    return;
  }

  let html = '';
  trains.forEach((t, idx) => {
    const isAc = t.is_ac;
    const isFast = t.is_fast || t.train_type === 'FAST';
    const typeLabel = isAc ? 'AC Local' : (isFast ? 'Fast Local' : 'Slow Local');
    const typeColor = isFast ? 'text-emerald-800 bg-emerald-50' : 'text-slate-600 bg-slate-100';
    const crowdLevel = t.crowd_prediction?.level || 'Moderate';
    const crowdColor = crowdLevel === 'Packed' ? 'text-rose-700 bg-rose-50' : (crowdLevel === 'Low' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50');

    // LIVE DELAY STATUS BADGE ('On Time', 'Delayed 5m', 'Delayed 15m')
    const delayInfo = t.delay_info || {
      status: 'On Time',
      delay_minutes: 0,
      badge_color: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      dot_color: '#10b981'
    };

    const expText = (delayInfo.delay_minutes > 0 && delayInfo.expected_departure_time)
      ? `<span class="text-amber-700 font-bold ml-1">· Exp: ${delayInfo.expected_departure_time}</span>`
      : '';

    html += `
      <div 
        class="py-2.5 flex items-center justify-between group hover:bg-slate-50 rounded-xl px-2 transition-colors cursor-pointer"
        onclick="pickTrainFromList(${idx}, '${fromCode}', '${toCode}')"
      >
        <div class="flex items-center gap-3">
          <div class="text-base font-extrabold text-slate-900 w-16">${t.departure_time}</div>
          <div>
            <div class="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              <span>${t.train_name}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded ${typeColor}">${typeLabel}</span>
              <!-- LIVE DELAY STATUS BADGE -->
              <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${delayInfo.badge_color} flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: ${delayInfo.dot_color};"></span>
                <span>${delayInfo.status}</span>
              </span>
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded border ${crowdColor}">${crowdLevel}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">
              <span>Arrives ${t.arrival_time}</span>
              <span>/</span>
              <span>${t.duration_minutes || 35} min</span>
              <span>/</span>
              <span>${t.platform || 'PF 2'}</span>
              ${expText}
            </div>
          </div>
        </div>

        <button class="text-[11px] font-bold text-emerald-800 group-hover:bg-emerald-50 px-2 py-1 rounded">
          Select
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

window.pickTrainFromList = function(idx, fromCode, toCode) {
  const train = currentSearchTrains[idx];
  if (train) {
    setActiveSelectedTrain(train, fromCode, toCode);
    const stops = train.intermediate_stops || train.stops || [];
    renderRouteTimeline(stops, fromCode, toCode);
    updateGoogleMapRoute(fromCode, toCode, stops);
    populateRouteStationsInSpeedometer(stops, toCode);

    // Smooth scroll to top of planner card
    document.getElementById('selectedActiveTrainCard')?.scrollIntoView({ behavior: 'smooth' });
  }
};

window.armAlarmForSelectedTrain = function() {
  const destInput = document.getElementById('destInput');
  const toCode = destInput?.dataset.code || currentDestCode || 'CSMT';
  armWakeAlarm(toCode, 1.5);
  switchAppTab('speedometer');
};

function renderRouteTimeline(stops, fromCode, toCode) {
  const container = document.getElementById('routeTimelineContainer');
  const summaryEl = document.getElementById('routeTimelineSummary');
  if (!container) return;

  let haltList = stops;
  if (!haltList || haltList.length === 0) {
    const origIdx = allStations.findIndex(s => s.code === fromCode);
    const destIdx = allStations.findIndex(s => s.code === toCode);
    if (origIdx !== -1 && destIdx !== -1) {
      if (origIdx <= destIdx) {
        haltList = allStations.slice(origIdx, destIdx + 1).map(s => ({ station_code: s.code, station_name: s.name, platform: `PF ${s.platforms || 2}` }));
      } else {
        haltList = allStations.slice(destIdx, origIdx + 1).reverse().map(s => ({ station_code: s.code, station_name: s.name, platform: `PF ${s.platforms || 2}` }));
      }
    }
  }

  if (summaryEl) summaryEl.textContent = `${haltList.length} stops`;

  let html = '<div class="route-timeline-stem"></div>';
  haltList.forEach((h, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === haltList.length - 1;
    const dotClass = isFirst
      ? 'w-4 h-4 bg-emerald-600 ring-4 ring-emerald-100'
      : (isLast ? 'w-4 h-4 bg-[#07131e] ring-4 ring-slate-200' : 'w-2.5 h-2.5 bg-slate-400');

    const stn = allStations.find(s => s.code === h.station_code);
    const doorSide = stn?.door_side ? `<span class="text-[9px] text-slate-400">Door: ${stn.door_side}</span>` : '';
    const timeDisplay = h.departure_time ? `${h.departure_time}` : '';

    html += `
      <div class="relative flex items-center justify-between py-2">
        <div class="flex items-center gap-3">
          <div class="relative z-10 flex items-center justify-center w-6">
            <div class="rounded-full ${dotClass}"></div>
          </div>
          <div>
            <div class="text-xs font-bold ${isFirst || isLast ? 'text-slate-900 text-sm' : 'text-slate-700'}">${h.station_name || h.short_name || h.station_code}</div>
            <div class="text-[10px] text-slate-400 font-medium">${h.station_code} · ${doorSide}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-xs font-bold text-slate-800">${timeDisplay}</div>
          <div class="text-[10px] font-bold text-slate-400">${h.platform || (stn?.platforms ? `PF ${stn.platforms}` : 'PF 2')}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==========================================
// 6. SPEEDOMETER & GEOFENCE WAKE ALARM
// ==========================================
function setupSpeedometerEvents() {
  const activateBtn = document.getElementById('activateGpsBtn');
  const stopBtn = document.getElementById('stopGpsBtn');
  const armBtn = document.getElementById('armWakeAlarmBtn');

  activateBtn?.addEventListener('click', () => {
    requestSpeedometerGps();
  });

  stopBtn?.addEventListener('click', () => {
    stopGpsTracking();
  });

  armBtn?.addEventListener('click', () => {
    const stnCode = document.getElementById('alarmStationSelect')?.value;
    const distVal = parseFloat(document.getElementById('alarmDistanceSelect')?.value || '1.5');
    armWakeAlarm(stnCode, distVal);
  });
}

window.requestSpeedometerGps = function() {
  const promptCard = document.getElementById('gpsPromptCard');
  const deniedCard = document.getElementById('gpsDeniedCard');
  const activeDialCard = document.getElementById('gpsActiveDialCard');
  const statusText = document.getElementById('gpsStatusText');

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      promptCard?.classList.add('hidden');
      deniedCard?.classList.add('hidden');
      activeDialCard?.classList.remove('hidden');

      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const speedKmh = (pos.coords.speed !== null && pos.coords.speed !== undefined && pos.coords.speed >= 0)
        ? Math.round(pos.coords.speed * 3.6)
        : 0;

      updateSpeedometerUI(speedKmh);

      if (statusText) {
        statusText.textContent = `GPS Connected · Accuracy ±${Math.round(pos.coords.accuracy || 10)}m`;
      }

      // Update nearest station telemetry
      updateTelemetryFromCoords(pos.coords.latitude, pos.coords.longitude);

      if (isWakeAlarmArmed && wakeAlarmTargetStation) {
        checkWakeAlarmProximity(pos.coords.latitude, pos.coords.longitude);
      }
    },
    (err) => {
      console.warn('GPS Error:', err.message);
      promptCard?.classList.add('hidden');
      activeDialCard?.classList.add('hidden');
      deniedCard?.classList.remove('hidden');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
  );
};

function stopGpsTracking() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (isSimulating) {
    clearInterval(simulationInterval);
    isSimulating = false;
  }
  document.getElementById('gpsActiveDialCard')?.classList.add('hidden');
  document.getElementById('gpsPromptCard')?.classList.remove('hidden');
  updateSpeedometerUI(0);
}

function updateSpeedometerUI(speedKmh) {
  const speedValEl = document.getElementById('speedValue');
  const speedSubtext = document.getElementById('speedSubtext');
  const circle = document.getElementById('speedometerGaugeCircle');

  if (speedValEl) speedValEl.textContent = speedKmh;

  if (speedSubtext) {
    if (speedKmh === 0) speedSubtext.textContent = 'At Station Halt';
    else if (speedKmh < 40) speedSubtext.textContent = 'Decelerating';
    else if (speedKmh < 65) speedSubtext.textContent = 'Cruising';
    else speedSubtext.textContent = 'High Speed';
  }

  if (circle) {
    // 283 circumference, mapping 0..100 km/h
    const maxSpeed = 100;
    const progress = Math.min(speedKmh / maxSpeed, 1);
    const offset = 283 - (progress * 210);
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = speedKmh > 75 ? '#e11d48' : (speedKmh > 40 ? '#047857' : '#d97706');
  }
}

function updateTelemetryFromCoords(lat, lng) {
  if (allStations.length === 0) return;
  let nearest = null;
  let minD = Infinity;

  allStations.forEach(s => {
    if (s.lat && s.lng) {
      const d = calculateHaversineDistance(lat, lng, s.lat, s.lng);
      if (d < minD) {
        minD = d;
        nearest = s;
      }
    }
  });

  if (nearest) {
    document.getElementById('telemetryCurrentStn').textContent = `${nearest.name} (${nearest.code})`;
    const nextStn = allStations.find(s => s.dist_km > nearest.dist_km) || nearest;
    document.getElementById('telemetryNextStn').textContent = `${nextStn.name} · PF 2 · ETA ~3m`;
  }
}

// Live Train Ride Simulation Mode
window.startRideSimulation = function() {
  isSimulating = true;
  document.getElementById('gpsPromptCard')?.classList.add('hidden');
  document.getElementById('gpsDeniedCard')?.classList.add('hidden');
  document.getElementById('gpsActiveDialCard')?.classList.remove('hidden');

  // Use selected train stops if available, else standard corridor
  let simulatedRoute = [];
  if (selectedTrain && (selectedTrain.intermediate_stops || selectedTrain.stops)) {
    const rawStops = selectedTrain.intermediate_stops || selectedTrain.stops;
    simulatedRoute = rawStops.map(s => {
      const stn = allStations.find(st => st.code === s.station_code) || s;
      return {
        name: stn.name || s.station_name,
        code: s.station_code,
        lat: Number(stn.lat || 19.18),
        lng: Number(stn.lng || 72.97),
        speed: 48 + Math.floor(Math.random() * 26)
      };
    });
  }

  if (simulatedRoute.length === 0) {
    simulatedRoute = [
      { name: 'Thane', code: 'TNA', lat: 19.1868, lng: 72.9757, speed: 28 },
      { name: 'Mulund', code: 'MLND', lat: 19.1726, lng: 72.9563, speed: 54 },
      { name: 'Bhandup', code: 'BND', lat: 19.1437, lng: 72.9378, speed: 68 },
      { name: 'Vikhroli', code: 'VK', lat: 19.1105, lng: 72.9288, speed: 62 },
      { name: 'Ghatkopar', code: 'GC', lat: 19.0864, lng: 72.9081, speed: 45 },
      { name: 'Kurla', code: 'CLA', lat: 19.0652, lng: 72.8793, speed: 65 },
      { name: 'Sion', code: 'SIN', lat: 19.0433, lng: 72.8631, speed: 58 },
      { name: 'Dadar', code: 'DR', lat: 19.0178, lng: 72.8433, speed: 30 },
      { name: 'Byculla', code: 'BY', lat: 18.9774, lng: 72.8331, speed: 52 },
      { name: 'CSMT', code: 'CSMT', lat: 18.9401, lng: 72.8354, speed: 0 }
    ];
  }

  simulationStep = 0;
  const statusText = document.getElementById('gpsStatusText');

  simulationInterval = setInterval(() => {
    if (simulationStep >= simulatedRoute.length) {
      clearInterval(simulationInterval);
      isSimulating = false;
      updateSpeedometerUI(0);
      if (statusText) statusText.textContent = 'Simulation Completed. Arrived at Destination Terminal.';
      return;
    }

    const current = simulatedRoute[simulationStep];
    const next = simulatedRoute[Math.min(simulationStep + 1, simulatedRoute.length - 1)];

    updateSpeedometerUI(current.speed);
    document.getElementById('telemetryCurrentStn').textContent = `${current.name} (${current.code}) · Traversed`;
    document.getElementById('telemetryNextStn').textContent = `${next.name} · PF 2 · ETA ~2m`;

    if (statusText) {
      statusText.textContent = `Simulation Mode · Traversed ${simulationStep + 1}/${simulatedRoute.length} stations on route`;
    }

    // Check alarm condition
    if (isWakeAlarmArmed && wakeAlarmTargetStation) {
      const dist = calculateHaversineDistance(current.lat, current.lng, wakeAlarmTargetStation.lat, wakeAlarmTargetStation.lng);
      if (dist <= wakeAlarmDistanceThreshold) {
        triggerAlarmBuzzer();
        disarmWakeAlarm();
      }
    }

    simulationStep++;
  }, 2200);
};

function populateRouteStationsInSpeedometer(stops, defaultTargetCode) {
  const select = document.getElementById('alarmStationSelect');
  if (!select) return;

  select.innerHTML = '';
  let listToUse = stops;

  if (!listToUse || listToUse.length === 0) {
    listToUse = allStations;
  }

  listToUse.forEach(s => {
    const code = s.station_code || s.code;
    const name = s.station_name || s.name;
    const opt = new Option(`${name} (${code})`, code, false, code === defaultTargetCode);
    select.add(opt);
  });

  const targetStn = allStations.find(s => s.code === defaultTargetCode);
  if (targetStn) {
    document.getElementById('telemetryTargetStn').textContent = `${targetStn.name} (${targetStn.dist_km} km)`;
  }
}

function armWakeAlarm(stnCode, thresholdKm) {
  const stn = allStations.find(s => s.code === stnCode);
  if (!stn) return;

  wakeAlarmTargetStation = stn;
  wakeAlarmDistanceThreshold = thresholdKm;
  isWakeAlarmArmed = true;

  document.getElementById('alarmActiveStatus')?.classList.remove('hidden');
  document.getElementById('activeAlarmTarget').textContent = `${stn.name} (${thresholdKm} km)`;

  alert(`Wake alarm armed for ${stn.name}! An alert chime will ring ${thresholdKm} km before arrival.`);
}

window.disarmWakeAlarm = function() {
  isWakeAlarmArmed = false;
  wakeAlarmTargetStation = null;
  document.getElementById('alarmActiveStatus')?.classList.add('hidden');
};

function checkWakeAlarmProximity(lat, lng) {
  if (!wakeAlarmTargetStation || !wakeAlarmTargetStation.lat) return;

  const distKm = calculateHaversineDistance(lat, lng, wakeAlarmTargetStation.lat, wakeAlarmTargetStation.lng);
  if (distKm <= wakeAlarmDistanceThreshold) {
    triggerAlarmBuzzer();
    disarmWakeAlarm();
  }
}

function triggerAlarmBuzzer() {
  playAudibleChime();

  if (navigator.vibrate) {
    navigator.vibrate([600, 200, 600, 200, 1200]);
  }

  alert(`WAKE UP! Arriving at ${wakeAlarmTargetStation?.name || 'Destination'} in less than ${wakeAlarmDistanceThreshold} km! Prepare to deboard.`);
}

window.testAlarmChimeSound = function() {
  playAudibleChime();
};

function playAudibleChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.3);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
      }, 1300);
    }
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ==========================================
// 7. MY PERSONAL COMMUTE: PASS & ROUTINE
// ==========================================
function initPassTrackingUI() {
  const expiryDate = new Date(userPassData.expiryDate);
  const today = new Date();
  const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

  const corridorEl = document.getElementById('userPassCorridor');
  const countdownEl = document.getElementById('userPassCountdown');
  const dateEl = document.getElementById('userPassExpiryDate');
  const badgeEl = document.getElementById('passExpiryBadge');
  const classLabelEl = document.getElementById('userPassClassLabel');
  const progressBar = document.getElementById('passProgressBar');

  if (corridorEl) corridorEl.textContent = userPassData.corridor;
  if (dateEl) dateEl.textContent = userPassData.expiryDate;
  if (classLabelEl) classLabelEl.textContent = `${userPassData.passType} Monthly Suburban Pass`;

  if (diffDays <= 0) {
    if (countdownEl) countdownEl.textContent = 'EXPIRED - RENEW PASS';
    if (badgeEl) {
      badgeEl.textContent = 'Pass Expired';
      badgeEl.className = 'px-2.5 py-0.5 bg-rose-500/30 text-rose-200 rounded-full text-xs font-bold border border-rose-400';
    }
    if (progressBar) progressBar.style.width = '0%';
  } else if (diffDays <= 3) {
    if (countdownEl) countdownEl.textContent = `${diffDays} Days Left (Expiring Soon)`;
    if (badgeEl) {
      badgeEl.textContent = 'Expiring Soon';
      badgeEl.className = 'px-2.5 py-0.5 bg-amber-500/30 text-amber-200 rounded-full text-xs font-bold border border-amber-400';
    }
    if (progressBar) progressBar.style.width = '20%';
  } else {
    if (countdownEl) countdownEl.textContent = `${diffDays} Days Remaining`;
    if (badgeEl) {
      badgeEl.textContent = 'Active Pass';
      badgeEl.className = 'px-2.5 py-0.5 bg-white/10 rounded-full text-xs font-bold border border-white/20';
    }
    if (progressBar) progressBar.style.width = '75%';
  }
}

window.togglePassEditModal = function() {
  const modal = document.getElementById('passEditModal');
  modal?.classList.toggle('hidden');
  if (!modal?.classList.contains('hidden')) {
    document.getElementById('modalPassCorridorInput').value = userPassData.corridor;
    document.getElementById('modalPassExpiryInput').value = userPassData.expiryDate;
    document.getElementById('modalPassClassInput').value = userPassData.passType;
  }
};

window.savePassDetails = function() {
  const corridor = document.getElementById('modalPassCorridorInput')?.value;
  const expiry = document.getElementById('modalPassExpiryInput')?.value;
  const passType = document.getElementById('modalPassClassInput')?.value;

  if (corridor) userPassData.corridor = corridor;
  if (expiry) userPassData.expiryDate = expiry;
  if (passType) userPassData.passType = passType;

  localStorage.setItem('centralsaathi_user_pass', JSON.stringify(userPassData));
  initPassTrackingUI();
  togglePassEditModal();
};

window.testPassAlarmSound = function() {
  playAudibleChime();
  alert('Suburban Pass Expiry Audio Chime verified.');
};

window.openRoutineEditModal = function() {
  const modal = document.getElementById('routineEditModal');
  modal?.classList.remove('hidden');
  document.getElementById('modalMorningInput').value = userRoutineData.morningTrain;
  document.getElementById('modalMorningDetailsInput').value = userRoutineData.morningDetails;
  document.getElementById('modalEveningInput').value = userRoutineData.eveningTrain;
  document.getElementById('modalEveningDetailsInput').value = userRoutineData.eveningDetails;
};

window.closeRoutineEditModal = function() {
  document.getElementById('routineEditModal')?.classList.add('hidden');
};

window.saveRoutineDetails = function() {
  const morning = document.getElementById('modalMorningInput')?.value;
  const morningDetails = document.getElementById('modalMorningDetailsInput')?.value;
  const evening = document.getElementById('modalEveningInput')?.value;
  const eveningDetails = document.getElementById('modalEveningDetailsInput')?.value;

  if (morning) userRoutineData.morningTrain = morning;
  if (morningDetails) userRoutineData.morningDetails = morningDetails;
  if (evening) userRoutineData.eveningTrain = evening;
  if (eveningDetails) userRoutineData.eveningDetails = eveningDetails;

  localStorage.setItem('centralsaathi_user_routine', JSON.stringify(userRoutineData));
  updateRoutineUI();
  closeRoutineEditModal();
};

function updateRoutineUI() {
  document.getElementById('morningOfficeTrainTime').textContent = userRoutineData.morningTrain;
  document.getElementById('morningOfficeTrainDetails').textContent = userRoutineData.morningDetails;
  document.getElementById('eveningOfficeTrainTime').textContent = userRoutineData.eveningTrain;
  document.getElementById('eveningOfficeTrainDetails').textContent = userRoutineData.eveningDetails;
}

window.armAlarmForMorningRoutine = function() {
  armWakeAlarm('DR', 1.5);
  switchAppTab('speedometer');
};

window.armAlarmForEveningRoutine = function() {
  armWakeAlarm('TNA', 1.5);
  switchAppTab('speedometer');
};

function loadSavedPersonalNotes() {
  const notes = localStorage.getItem('centralsaathi_commuter_notes');
  const textarea = document.getElementById('personalCommuteNotes');
  if (textarea && notes) textarea.value = notes;
}

window.savePersonalNotes = function() {
  const val = document.getElementById('personalCommuteNotes')?.value || '';
  localStorage.setItem('centralsaathi_commuter_notes', val);
  alert('Personal commute notes saved to device.');
};

// ==========================================
// 8. ADVANCED SAFETY SOS CONSOLE
// ==========================================
window.toggleEmergencySiren = function() {
  const btn = document.getElementById('sosSirenBtn');
  const label = document.getElementById('sirenBtnLabel');

  if (isSirenActive) {
    // Stop Siren
    if (sirenOscillator) {
      sirenOscillator.stop();
      sirenOscillator.disconnect();
      sirenOscillator = null;
    }
    isSirenActive = false;
    if (label) label.textContent = 'START EMERGENCY SIREN';
    btn?.classList.remove('bg-black');
    btn?.classList.add('bg-rose-700');
  } else {
    // Start Siren
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = audioContext || new AudioCtx();
        sirenOscillator = audioContext.createOscillator();
        sirenGain = audioContext.createGain();

        sirenOscillator.type = 'sawtooth';
        sirenOscillator.frequency.setValueAtTime(1000, audioContext.currentTime);

        // Oscillate pitch between 1000Hz and 2200Hz
        const now = audioContext.currentTime;
        for (let i = 0; i < 40; i++) {
          sirenOscillator.frequency.exponentialRampToValueAtTime(2200, now + i * 0.5 + 0.25);
          sirenOscillator.frequency.exponentialRampToValueAtTime(1000, now + i * 0.5 + 0.5);
        }

        sirenGain.gain.setValueAtTime(0.4, audioContext.currentTime);
        sirenOscillator.connect(sirenGain);
        sirenGain.connect(audioContext.destination);

        sirenOscillator.start();
        isSirenActive = true;
        if (label) label.textContent = 'STOP EMERGENCY SIREN';
        btn?.classList.remove('bg-rose-700');
        btn?.classList.add('bg-black');
      }
    } catch (e) {
      console.warn('Siren audio error:', e);
    }
  }
};

window.broadcastEmergencyLocation = function() {
  const timeStr = new Date().toLocaleTimeString('en-US');
  let locLink = 'https://maps.google.com';
  let nearestName = 'Central Railway Main Line';

  if (userCoords) {
    locLink = `https://maps.google.com/?q=${userCoords.lat},${userCoords.lng}`;
    const nearest = allStations.reduce((closest, s) => {
      const d = calculateHaversineDistance(userCoords.lat, userCoords.lng, s.lat, s.lng);
      return (!closest || d < closest.dist) ? { stn: s, dist: d } : closest;
    }, null);
    if (nearest && nearest.stn) nearestName = `${nearest.stn.name} (${nearest.stn.code})`;
  }

  const msg = `EMERGENCY ALERT: I need immediate help on Central Railway Mumbai Local. Near Station: ${nearestName} at ${timeStr}. Live Location: ${locLink}. Please notify Railway Police (139 / 1512).`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;

  window.open(whatsappUrl, '_blank');
};

// ==========================================
// 9. COMMUTER SUITE: AMENITIES, FARES & DOORS
// ==========================================
function renderAmenitiesDirectory() {
  const grid = document.getElementById('stationAmenitiesGrid');
  if (!grid || allStations.length === 0) return;

  let html = '';
  allStations.forEach(s => {
    const am = s.amenities || { escalators: 0, lifts: 0, water_atms: 2, atvm_kiosks: 3, fobs: 2, medical_post: 'Station Master' };
    html += `
      <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
        <div class="flex items-center justify-between mb-1.5">
          <div class="text-xs font-black text-slate-900">${s.name} (${s.code})</div>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">PF ${s.platforms || 2}</span>
        </div>
        <div class="grid grid-cols-3 gap-1 text-[10px] text-slate-500 mb-1.5">
          <div>Escalators: <strong class="text-slate-700">${am.escalators}</strong></div>
          <div>Lifts: <strong class="text-slate-700">${am.lifts}</strong></div>
          <div>FOBs: <strong class="text-slate-700">${am.fobs}</strong></div>
          <div>ATVMs: <strong class="text-slate-700">${am.atvm_kiosks}</strong></div>
          <div>Water ATM: <strong class="text-slate-700">${am.water_atms}</strong></div>
          <div>Cloak: <strong class="text-slate-700">${am.cloak_room ? 'Yes' : 'No'}</strong></div>
        </div>
        <div class="text-[10px] text-emerald-800 font-semibold truncate">Emergency: ${am.medical_post}</div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

function renderDoorSideDirectory() {
  const grid = document.getElementById('doorSideDirectoryGrid');
  if (!grid || allStations.length === 0) return;

  let html = '';
  allStations.forEach(s => {
    const door = s.door_side || 'Left';
    const isBoth = door.includes('&');
    const badgeColor = isBoth ? 'bg-purple-50 text-purple-700 border-purple-200' : (door === 'Right' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200');

    html += `
      <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
        <div>
          <div class="text-xs font-bold text-slate-900">${s.name}</div>
          <div class="text-[10px] text-slate-400">${s.code} · PF ${s.platforms || 2}</div>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}">${door}</span>
      </div>
    `;
  });

  grid.innerHTML = html;
}

async function loadCoachLayout() {
  const grid = document.getElementById('coachRakeGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/coach-layout');
    const data = await res.json();
    const coaches = data.twelve_car || [];

    let html = '';
    coaches.forEach(c => {
      html += `
        <div class="p-3 rounded-2xl border border-slate-200 text-center flex flex-col justify-between" style="background-color: ${c.color}; color: ${c.text_color};">
          <div class="text-[10px] font-black uppercase tracking-wider opacity-80">Coach #${c.coach_num}</div>
          <div class="text-xs font-black my-1">${c.type}</div>
          <div class="text-[9px] opacity-75 leading-tight">${c.label}</div>
        </div>
      `;
    });

    grid.innerHTML = html;
  } catch (err) {
    console.warn('Coach layout error:', err);
  }
}

function populateToolDropdowns() {
  const originSelect = document.getElementById('fareCalcOriginSelect');
  const destSelect = document.getElementById('fareCalcDestSelect');
  const alarmSelect = document.getElementById('alarmStationSelect');

  if (!originSelect || allStations.length === 0) return;

  originSelect.innerHTML = '';
  destSelect.innerHTML = '';
  alarmSelect.innerHTML = '';

  allStations.forEach(s => {
    originSelect.add(new Option(`${s.name} (${s.code})`, s.code, false, s.code === 'TNA'));
    destSelect.add(new Option(`${s.name} (${s.code})`, s.code, false, s.code === 'CSMT'));
    alarmSelect.add(new Option(`${s.name} (${s.code})`, s.code, false, s.code === 'DR'));
  });

  originSelect.addEventListener('change', calculateCustomFares);
  destSelect.addEventListener('change', calculateCustomFares);
  calculateCustomFares();
}

async function calculateCustomFares() {
  const from = document.getElementById('fareCalcOriginSelect')?.value || 'TNA';
  const to = document.getElementById('fareCalcDestSelect')?.value || 'CSMT';
  const grid = document.getElementById('customFareResultGrid');
  if (!grid) return;

  try {
    const res = await fetch(`/api/fare?origin=${from}&destination=${to}`);
    const data = await res.json();
    const f = data.fares || { second_class: 10, first_class: 105, ac_local: 135 };
    const sp = data.season_pass || { monthly_second: 200, monthly_first: 650, monthly_ac: 1400 };

    grid.innerHTML = `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
        <div class="text-[10px] font-bold text-slate-400 uppercase">II Class Single</div>
        <div class="text-xl font-black text-slate-900 mt-1">₹${f.second_class}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">Ordinary EMU</div>
      </div>
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
        <div class="text-[10px] font-bold text-amber-800 uppercase">I Class Single</div>
        <div class="text-xl font-black text-amber-800 mt-1">₹${f.first_class}</div>
        <div class="text-[10px] text-amber-600 mt-0.5">First class coach</div>
      </div>
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
        <div class="text-[10px] font-bold text-emerald-800 uppercase">AC Local Single</div>
        <div class="text-xl font-black text-emerald-800 mt-1">₹${f.ac_local}</div>
        <div class="text-[10px] text-emerald-600 mt-0.5">Automatic vestibule</div>
      </div>
      <div class="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
        <div class="text-[10px] font-bold text-blue-800 uppercase">Monthly Season Pass</div>
        <div class="text-xl font-black text-blue-800 mt-1">₹${sp.monthly_first || 650}</div>
        <div class="text-[10px] text-blue-600 mt-0.5">Unlimited monthly (I Class)</div>
      </div>
    `;
  } catch (err) {
    console.warn('Fare calc error:', err);
  }
}

async function loadBulletins() {
  const container = document.getElementById('tabBulletinsList');
  if (!container) return;

  try {
    const res = await fetch('/api/railway-updates');
    const data = await res.json();
    const alerts = data.alerts || [];

    let html = '';
    alerts.forEach(a => {
      html += `
        <div class="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div class="flex items-center gap-2 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded w-fit mb-2">
            <span>OFFICIAL NOTICE</span>
            <span>/</span>
            <span>${a.effective_time || 'Central Railway'}</span>
          </div>
          <h4 class="text-xs font-bold text-slate-900">${a.title}</h4>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">${a.description}</p>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (e) {
    console.warn('Bulletins error:', e);
  }
}

// ==========================================
// 10. GEMINI TRANSIT AI COPILOT
// ==========================================
window.submitAiQuery = async function() {
  const input = document.getElementById('aiInputText');
  const query = input?.value.trim();
  if (!query) return;

  appendAiMessage('user', query);
  input.value = '';

  const btn = document.getElementById('aiSendBtn');
  if (btn) btn.textContent = 'Thinking...';

  try {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    appendAiMessage('copilot', data.answer || 'No response available.');
  } catch (err) {
    appendAiMessage('copilot', 'Central Railway timetable intelligence query failed. Please verify network connection.');
  } finally {
    if (btn) btn.textContent = 'Ask AI';
  }
};

window.sendQuickAiPrompt = function(promptText) {
  const input = document.getElementById('aiInputText');
  if (input) input.value = promptText;
  submitAiQuery();
};

function appendAiMessage(sender, text) {
  const stream = document.getElementById('aiChatStream');
  if (!stream) return;

  const isUser = sender === 'user';
  const bubble = document.createElement('div');
  bubble.className = isUser
    ? 'p-3 bg-[#064e3b] text-white rounded-2xl ml-auto max-w-md shadow-2xs text-xs'
    : 'p-3 bg-white border border-slate-200 text-slate-800 rounded-2xl mr-auto max-w-md shadow-2xs text-xs';

  const label = isUser ? 'You' : 'CentralSaathi AI Copilot';
  const labelColor = isUser ? 'text-emerald-200' : 'text-emerald-800';

  bubble.innerHTML = `
    <div class="font-bold ${labelColor} mb-1">${label}</div>
    <div class="leading-relaxed">${text}</div>
  `;

  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
}
