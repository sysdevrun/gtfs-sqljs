/**
 * Helper to encode GTFS-RT FeedMessage protobuf buffers for tests.
 * Declares its own minimal proto so tests stay decoupled from the loader's copy.
 */

import protobuf from 'protobufjs';

const TEST_PROTO = `
syntax = "proto2";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional uint64 timestamp = 3;
}

message FeedEntity {
  required string id = 1;
  optional TripUpdate trip_update = 3;
}

message TripUpdate {
  required TripDescriptor trip = 1;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;
  optional int32 delay = 5;

  message StopTimeEvent {
    optional int32 delay = 1;
    optional int64 time = 2;
    optional int32 uncertainty = 3;
  }

  message StopTimeUpdate {
    optional uint32 stop_sequence = 1;
    optional string stop_id = 4;
    optional StopTimeEvent arrival = 2;
    optional StopTimeEvent departure = 3;
    enum ScheduleRelationship {
      SCHEDULED = 0;
      SKIPPED = 1;
      NO_DATA = 2;
      UNSCHEDULED = 3;
    }
    optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];
  }
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  enum ScheduleRelationship {
    SCHEDULED = 0;
    ADDED = 1;
    UNSCHEDULED = 2;
    CANCELED = 3;
  }
  optional ScheduleRelationship schedule_relationship = 4;
}
`;

let feedMessageType: protobuf.Type | null = null;

function getFeedMessageType(): protobuf.Type {
  if (!feedMessageType) {
    feedMessageType = protobuf.parse(TEST_PROTO).root.lookupType('transit_realtime.FeedMessage');
  }
  return feedMessageType;
}

/**
 * Encode a FeedMessage containing the given trip updates.
 * Entities use protobufjs camelCase field names, e.g.:
 * { trip: { tripId: 'TRIP1' }, stopTimeUpdate: [{ stopSequence: 2, departure: { delay: 120 } }] }
 */
export function encodeTripUpdatesFeed(tripUpdates: object[]): Uint8Array {
  const FeedMessage = getFeedMessageType();
  const payload = {
    header: { gtfsRealtimeVersion: '2.0' },
    entity: tripUpdates.map((tripUpdate, index) => ({
      id: `entity-${index}`,
      tripUpdate,
    })),
  };
  const error = FeedMessage.verify(payload);
  if (error) throw new Error(`Invalid test feed payload: ${error}`);
  return FeedMessage.encode(FeedMessage.create(payload)).finish();
}
