import initSqlJs from 'sql.js';
import { GtfsSqlJs } from 'gtfs-sqljs';
import type { Route, Trip, StopTime, Calendar } from 'gtfs-sqljs';

let gtfs: GtfsSqlJs;

// Initialize the demo
async function init() {
  const loadingEl = document.getElementById('loading')!;
  const errorEl = document.getElementById('error')!;
  const contentEl = document.getElementById('demo-content')!;

  try {
    // Initialize SQL.js with CDN WASM file
    const SQL = await initSqlJs({
      locateFile: (filename) => `https://sql.js.org/dist/${filename}`
    });

    // Load GTFS data
    gtfs = await GtfsSqlJs.fromZip('/car-jaune.zip', { SQL });

    // Hide loading, show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Render initial data
    renderCalendarInfo();
    renderRoutes();
  } catch (error) {
    console.error('Error loading GTFS data:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
  }
}

// Render calendar information
function renderCalendarInfo() {
  const calendarInfoEl = document.getElementById('calendar-info')!;

  const db = gtfs.getDatabase();
  const stmt = db.prepare('SELECT * FROM calendar');

  const calendars: Calendar[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    calendars.push({
      service_id: String(row.service_id),
      monday: Number(row.monday),
      tuesday: Number(row.tuesday),
      wednesday: Number(row.wednesday),
      thursday: Number(row.thursday),
      friday: Number(row.friday),
      saturday: Number(row.saturday),
      sunday: Number(row.sunday),
      start_date: String(row.start_date),
      end_date: String(row.end_date),
    });
  }
  stmt.free();

  if (calendars.length === 0) {
    calendarInfoEl.innerHTML = '<p>No calendar data available</p>';
    return;
  }

  const html = calendars.map(cal => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const values = [
      cal.monday,
      cal.tuesday,
      cal.wednesday,
      cal.thursday,
      cal.friday,
      cal.saturday,
      cal.sunday
    ];

    const daysHtml = days.map((day, i) =>
      `<div class="day ${values[i] ? 'active' : 'inactive'}">${day}</div>`
    ).join('');

    return `
      <div class="calendar-card">
        <h3>${cal.service_id}</h3>
        <div class="calendar-days">${daysHtml}</div>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
          ${formatDate(cal.start_date)} - ${formatDate(cal.end_date)}
        </p>
      </div>
    `;
  }).join('');

  calendarInfoEl.innerHTML = html;
}

// Render routes list
function renderRoutes() {
  const routesListEl = document.getElementById('routes-list')!;
  const routes = gtfs.getAllRoutes();

  if (routes.length === 0) {
    routesListEl.innerHTML = '<p>No routes found</p>';
    return;
  }

  const html = routes.map(route => {
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

  // Get trips for this route
  const trips = gtfs.getTripsByRoute(routeId);

  if (trips.length === 0) {
    tripsListEl.innerHTML = '<p>No trips found for this route</p>';
    tripsSectionEl.style.display = 'block';
    selectedRouteNameEl.textContent = routeName;
    return;
  }

  // Render trips
  const html = trips.map(trip => {
    const headsign = trip.trip_headsign || 'No headsign';
    const direction = trip.direction_id !== undefined ? `Direction ${trip.direction_id}` : '';
    const service = trip.service_id;

    return `
      <div class="trip-card" onclick="showStopTimes('${trip.trip_id}', '${escapeHtml(headsign)}')">
        <div class="trip-info">
          <div class="trip-headsign">${escapeHtml(headsign)}</div>
          <div class="trip-meta">
            Trip ID: ${escapeHtml(trip.trip_id)}
            ${direction ? `• ${direction}` : ''}
            • Service: ${escapeHtml(service)}
          </div>
        </div>
        <div>→</div>
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

// Utility functions

function formatDate(dateStr: string): string {
  // YYYYMMDD -> DD/MM/YYYY
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

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
