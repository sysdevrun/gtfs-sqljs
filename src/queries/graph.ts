/**
 * Graph query methods
 *
 * Build a directed graph from GTFS trips: nodes are stops, edges connect
 * consecutive stops within a trip (ordered by `stop_sequence`, which is only
 * guaranteed monotonic — gaps are allowed). Edges are deduplicated; each
 * edge carries the list of trips that traverse it, so callers can recover
 * frequency, route, and direction information without a second query.
 */

import type { GtfsDatabase } from '../adapters/types';

export interface EdgeTrip {
  tripId: string;
  routeId: string;
  directionId: number | null;
}

export interface EdgeData {
  trips: EdgeTrip[];
}

/** Directed graph: from stop_id -> to stop_id -> edge data. */
export type Graph = Map<string, Map<string, EdgeData>>;

/**
 * Build a directed stop-to-stop graph for the given trips.
 *
 * - Uses `LEAD()` to pair each stop with its successor in `stop_sequence`
 *   order, so non-contiguous sequences (e.g. 1, 5, 10) are handled correctly.
 * - Edges are deduplicated on `(from, to)`; per-edge `trips[]` preserves the
 *   originating trip/route/direction.
 * - A trip that traverses the same edge twice (e.g. a loop) contributes two
 *   entries in `trips[]`.
 * - An empty `tripIds` array returns an empty graph without touching the DB.
 */
export async function buildGraph(
  db: GtfsDatabase,
  tripIds: string[]
): Promise<Graph> {
  const graph: Graph = new Map();
  if (tripIds.length === 0) return graph;

  const placeholders = tripIds.map(() => '?').join(', ');
  const sql = `
    WITH ordered AS (
      SELECT st.trip_id,
             st.stop_id,
             LEAD(st.stop_id) OVER (
               PARTITION BY st.trip_id ORDER BY st.stop_sequence
             ) AS next_stop,
             t.route_id,
             t.direction_id
      FROM stop_times st
      INNER JOIN trips t ON st.trip_id = t.trip_id
      WHERE st.trip_id IN (${placeholders})
    )
    SELECT stop_id AS from_stop,
           next_stop AS to_stop,
           trip_id,
           route_id,
           direction_id
    FROM ordered
    WHERE next_stop IS NOT NULL
  `;

  const stmt = await db.prepare(sql);
  await stmt.bind(tripIds);

  while (await stmt.step()) {
    const row = await stmt.getAsObject();
    const from = String(row.from_stop);
    const to = String(row.to_stop);
    const edgeTrip: EdgeTrip = {
      tripId: String(row.trip_id),
      routeId: String(row.route_id),
      directionId: row.direction_id !== null ? Number(row.direction_id) : null,
    };

    let inner = graph.get(from);
    if (!inner) {
      inner = new Map();
      graph.set(from, inner);
    }
    let edge = inner.get(to);
    if (!edge) {
      edge = { trips: [] };
      inner.set(to, edge);
    }
    edge.trips.push(edgeTrip);
  }

  await stmt.free();
  return graph;
}

/** Number of distinct directed edges in the graph. */
export function edgeCount(graph: Graph): number {
  let n = 0;
  for (const inner of graph.values()) n += inner.size;
  return n;
}

/** Iterate all edges as `{ from, to, data }` tuples. */
export function* edges(
  graph: Graph
): Generator<{ from: string; to: string; data: EdgeData }> {
  for (const [from, inner] of graph) {
    for (const [to, data] of inner) {
      yield { from, to, data };
    }
  }
}
