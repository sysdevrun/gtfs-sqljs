/**
 * Pathfinder
 * Finds paths in the transit graph using Dijkstra's algorithm
 */

import { alg } from 'graphlib';
import type { TransitGraph, ItineraryPath, RouteSegment } from './types';

/**
 * Find the shortest path between two stops
 * Returns the path with route segments, or null if no path exists
 */
export function findPath(
  transitGraph: TransitGraph,
  startStopId: string,
  endStopId: string,
  maxTransfers: number = 5
): ItineraryPath | null {
  const { graph, metadata } = transitGraph;

  // Check if both stops exist in the graph
  if (!graph.hasNode(startStopId)) {
    throw new Error(`Start stop ${startStopId} not found in graph`);
  }
  if (!graph.hasNode(endStopId)) {
    throw new Error(`End stop ${endStopId} not found in graph`);
  }

  // Same stop - no journey needed
  if (startStopId === endStopId) {
    return {
      startStopId,
      endStopId,
      segments: [],
      totalTransfers: 0
    };
  }

  // Run Dijkstra's algorithm
  const dijkstraResult = alg.dijkstra(graph, startStopId, (e) => {
    // Use edge weight (default 1)
    const edgeData = graph.edge(e);
    return edgeData?.weight || 1;
  });

  // Check if path exists
  if (!dijkstraResult[endStopId] || dijkstraResult[endStopId].distance === Infinity) {
    return null;  // No path found
  }

  // Reconstruct path
  const pathNodes: string[] = [];
  let currentNode = endStopId;

  while (currentNode !== startStopId) {
    pathNodes.unshift(currentNode);
    const predecessor = dijkstraResult[currentNode].predecessor;
    if (!predecessor) break;
    currentNode = predecessor;
  }
  pathNodes.unshift(startStopId);

  // Convert to route segments
  const segments: RouteSegment[] = [];

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const from = pathNodes[i];
    const to = pathNodes[i + 1];
    const edgeKey = `${from}->${to}`;
    const routeOptions = metadata.get(edgeKey) || [];

    // Take the first route option
    // In a more advanced implementation, we could optimize for:
    // - Fewer transfers (prefer same route as previous segment)
    // - Faster routes
    // - Less crowded routes
    if (routeOptions.length > 0) {
      const routeEdge = routeOptions[0];
      segments.push({
        routeId: routeEdge.routeId,
        directionId: routeEdge.directionId,
        boardStopId: from,
        alightStopId: to,
        intermediateStops: routeEdge.intermediateStops,
        routeShortName: routeEdge.routeShortName,
        routeLongName: routeEdge.routeLongName
      });
    }
  }

  const totalTransfers = segments.length - 1;

  // Check if path exceeds max transfers
  if (totalTransfers > maxTransfers) {
    return null;
  }

  return {
    startStopId,
    endStopId,
    segments,
    totalTransfers
  };
}

/**
 * Find multiple paths with different characteristics
 * This is a simplified version - a full implementation would use k-shortest paths
 */
export function findMultiplePaths(
  transitGraph: TransitGraph,
  startStopId: string,
  endStopId: string,
  maxTransfers: number = 5,
  maxPaths: number = 3
): ItineraryPath[] {
  // For now, just return the single shortest path
  // A full implementation would use Yen's algorithm or similar
  const path = findPath(transitGraph, startStopId, endStopId, maxTransfers);
  return path ? [path] : [];
}
