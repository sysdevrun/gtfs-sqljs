import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';
import type { Route, Trip, StopTime, Agency } from 'gtfs-sqljs';

let gtfs: GtfsSqlJs;
let selectedDate: string;
let SQL: any;

// Convert https URL to proxy URL
function getProxyUrl(httpsUrl: string): string {
  if (!httpsUrl.startsWith('https://')) {
    throw new Error('URL must start with https://');
  }
  // Remove https:// prefix
  const withoutProtocol = httpsUrl.substring(8);
  return `https://gtfs-proxy.sys-dev-run.re/proxy/${withoutProtocol}`;
}

// Load GTFS from URL or default
async function loadGTFS(url?: string) {
  const loadingEl = document.getElementById('loading')!;
  const errorEl = document.getElementById('error')!;
  const errorMessageEl = document.getElementById('error-message')!;
  const contentEl = document.getElementById('demo-content')!;

  try {
    // Show loading, hide error and content
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';

    // Determine source
    let source: string;
    if (url) {
      source = getProxyUrl(url);
    } else {
      // Load default car-jaune.zip from public folder
      source = './car-jaune.zip';
    }

    // Load GTFS data
    // Skip shapes.txt to reduce memory usage and improve load time
    gtfs = await GtfsSqlJs.fromZip(source, {
      SQL,
      skipFiles: ['shapes.txt']
    });

    // Hide loading, show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Initialize date picker with today's date
    initDatePicker();

    // Setup download button
    setupDownloadButton();

    // Render initial data
    renderAgencies();
    renderActiveCalendars();
    renderRoutes();
  } catch (error) {
    console.error('Error loading GTFS data:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorMessageEl.textContent = `Error loading GTFS data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Initialize the demo
async function init() {
  try {
    // Initialize SQL.js with CDN WASM file
    SQL = await initSqlJs({
      locateFile: (filename) => `https://sql.js.org/dist/${filename}`
    });

    // Setup URL input handler
    const loadBtn = document.getElementById('load-gtfs-btn')!;
    const urlInput = document.getElementById('gtfs-url-input') as HTMLInputElement;

    loadBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        loadGTFS(url);
      }
    });

    // Load default GTFS (car-jaune.zip)
    await loadGTFS();
  } catch (error) {
    console.error('Error initializing demo:', error);
    const loadingEl = document.getElementById('loading')!;
    const errorEl = document.getElementById('error')!;
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// Initialize date picker
function initDatePicker() {
  const dateInput = document.getElementById('date-input') as HTMLInputElement;

  // Set to today's date
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  dateInput.value = todayStr;
  selectedDate = `${year}${month}${day}`; // YYYYMMDD format for GTFS

  // Listen for date changes
  dateInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const [y, m, d] = target.value.split('-');
    selectedDate = `${y}${m}${d}`;
    renderActiveCalendars();

    // Reset trips section
    document.getElementById('trips-section')!.style.display = 'none';
    document.getElementById('stop-times-section')!.style.display = 'none';
  });
}

// Render agencies
function renderAgencies() {
  const agenciesListEl = document.getElementById('agencies-list')!;

  try {
    const agencies = gtfs.getAgencies();

    if (agencies.length === 0) {
      agenciesListEl.innerHTML = '<p>No agency information available</p>';
      return;
    }

    const html = agencies.map((agency): string => {
      return `
        <div class="agency-card">
          <h3>${escapeHtml(agency.agency_name)}</h3>
          ${agency.agency_url ? `<p><a href="${escapeHtml(agency.agency_url)}" target="_blank">${escapeHtml(agency.agency_url)}</a></p>` : ''}
          ${agency.agency_timezone ? `<p><strong>Timezone:</strong> ${escapeHtml(agency.agency_timezone)}</p>` : ''}
          ${agency.agency_lang ? `<p><strong>Language:</strong> ${escapeHtml(agency.agency_lang)}</p>` : ''}
          ${agency.agency_phone ? `<p><strong>Phone:</strong> ${escapeHtml(agency.agency_phone)}</p>` : ''}
          ${agency.agency_email ? `<p><strong>Email:</strong> ${escapeHtml(agency.agency_email)}</p>` : ''}
        </div>
      `;
    }).join('');

    agenciesListEl.innerHTML = html;
  } catch (error) {
    console.error('Error getting agencies:', error);
    agenciesListEl.innerHTML = '<p>Error loading agency information</p>';
  }
}

// Render active calendars for selected date
function renderActiveCalendars() {
  const activeCalendarsEl = document.getElementById('active-calendars')!;

  try {
    const serviceIds = gtfs.getActiveServiceIds(selectedDate);

    if (serviceIds.length === 0) {
      activeCalendarsEl.innerHTML = '<p class="info-text">No active service calendars for this date</p>';
      return;
    }

    const html = `
      <p class="info-text">
        <strong>Active calendars:</strong> ${serviceIds.join(', ')}
      </p>
    `;
    activeCalendarsEl.innerHTML = html;
  } catch (error) {
    console.error('Error getting active calendars:', error);
    activeCalendarsEl.innerHTML = '<p class="info-text">Error loading calendar information</p>';
  }
}

// Render routes list
function renderRoutes() {
  const routesListEl = document.getElementById('routes-list')!;
  const routes = gtfs.getRoutes();

  if (routes.length === 0) {
    routesListEl.innerHTML = '<p>No routes found</p>';
    return;
  }

  const html = routes.map((route): string => {
    const bgColor = route.route_color ? `#${route.route_color}` : '#64748b';
    const textColor = route.route_text_color ? `#${route.route_text_color}` : getContrastColor(bgColor);

    return `
      <div class="route-card"
           data-route-id="${route.route_id}"
           style="background-color: ${bgColor}; color: ${textColor};"
           onclick="showTrips('${route.route_id}', '${escapeHtml(route.route_short_name)} - ${escapeHtml(route.route_long_name)}')">
        <div class="route-number">${escapeHtml(route.route_short_name)}</div>
        <div class="route-name">${escapeHtml(route.route_long_name)}</div>
      </div>
    `;
  }).join('');

  routesListEl.innerHTML = html;
}

// Show trips for a route
(window as any).showTrips = function(routeId: string, routeName: string) {
  const tripsSectionEl = document.getElementById('trips-section')!;
  const tripsListEl = document.getElementById('trips-list')!;
  const selectedRouteNameEl = document.getElementById('selected-route-name')!;
  const stopTimesSectionEl = document.getElementById('stop-times-section')!;

  // Hide stop times section
  stopTimesSectionEl.style.display = 'none';

  // Get trips for this route on the selected date
  const trips = gtfs.getTrips({
    routeId: routeId,
    date: selectedDate
  });

  if (trips.length === 0) {
    tripsListEl.innerHTML = '<p>No trips found for this route on the selected date</p>';
    tripsSectionEl.style.display = 'block';
    selectedRouteNameEl.textContent = routeName;
    return;
  }

  // Group trips by headsign and direction
  interface TripGroup {
    headsign: string;
    directionId: number;
    trips: Trip[];
  }

  const groupMap = new Map<string, TripGroup>();

  trips.forEach(trip => {
    const headsign = trip.trip_headsign || 'No headsign';
    const directionId = trip.direction_id ?? 0;
    const key = `${headsign}|${directionId}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        headsign,
        directionId,
        trips: []
      });
    }

    groupMap.get(key)!.trips.push(trip);
  });

  // Sort groups by direction, then by headsign
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.directionId !== b.directionId) {
      return a.directionId - b.directionId;
    }
    return a.headsign.localeCompare(b.headsign);
  });

  // Render grouped trips
  const html = groups.map(group => {
    const directionLabel = `Direction ${group.directionId}`;
    const tripCount = group.trips.length;

    // Sort trips by short name within each group
    const sortedTrips = [...group.trips].sort((a, b) => {
      const aName = a.trip_short_name || a.trip_id;
      const bName = b.trip_short_name || b.trip_id;
      return aName.localeCompare(bName, undefined, { numeric: true });
    });

    return `
      <div class="trip-group">
        <div class="trip-group-header">
          <div class="trip-headsign">${escapeHtml(group.headsign)}</div>
          <div class="trip-meta">${directionLabel} • ${tripCount} trip${tripCount > 1 ? 's' : ''}</div>
        </div>
        <div class="trip-items">
          ${sortedTrips.map(trip => {
            const tripName = trip.trip_short_name || trip.trip_id;
            const showTripId = trip.trip_short_name ? trip.trip_id : null;

            return `
              <div class="trip-card" onclick="showStopTimes('${trip.trip_id}', '${escapeHtml(group.headsign)}')">
                <div class="trip-info">
                  <div class="trip-name">${escapeHtml(tripName)}</div>
                  ${showTripId ? `<div class="trip-id-secondary">ID: ${escapeHtml(showTripId)}</div>` : ''}
                  <div class="trip-service">Service: ${escapeHtml(trip.service_id)}</div>
                </div>
                <div>→</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  tripsListEl.innerHTML = html;
  tripsSectionEl.style.display = 'block';
  selectedRouteNameEl.textContent = routeName;

  // Scroll to trips section
  tripsSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Show stop times for a trip
(window as any).showStopTimes = function(tripId: string, tripName: string) {
  const stopTimesSectionEl = document.getElementById('stop-times-section')!;
  const stopTimesListEl = document.getElementById('stop-times-list')!;
  const selectedTripNameEl = document.getElementById('selected-trip-name')!;

  // Get stop times for this trip
  const stopTimes = gtfs.getStopTimesByTrip(tripId);

  if (stopTimes.length === 0) {
    stopTimesListEl.innerHTML = '<p>No stop times found for this trip</p>';
    stopTimesSectionEl.style.display = 'block';
    selectedTripNameEl.textContent = tripName;
    return;
  }

  // Render stop times with stop names
  const html = stopTimes.map(st => {
    const stop = gtfs.getStopById(st.stop_id);
    const stopName = stop ? stop.stop_name : st.stop_id;

    return `
      <div class="stop-time-item">
        <div class="sequence">#${st.stop_sequence}</div>
        <div class="time">${st.arrival_time}</div>
        <div class="stop-name">${escapeHtml(stopName)}</div>
      </div>
    `;
  }).join('');

  stopTimesListEl.innerHTML = html;
  stopTimesSectionEl.style.display = 'block';
  selectedTripNameEl.textContent = tripName;

  // Scroll to stop times section
  stopTimesSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Setup download button
function setupDownloadButton() {
  const downloadBtn = document.getElementById('download-db-btn') as HTMLButtonElement;
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', () => {
    try {
      // Export database to ArrayBuffer
      const dbData = gtfs.export();

      // Create blob and download
      const blob = new Blob([dbData], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `car-jaune-${selectedDate}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading database:', error);
      alert('Failed to download database');
    }
  });
}

// Utility functions

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Start the demo
init();
