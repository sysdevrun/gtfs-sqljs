/**
 * GTFS static enums
 */

/**
 * Indicates whether passengers are picked up or dropped off at a stop.
 * Used for both pickup_type and drop_off_type fields in stop_times.
 *
 * @see https://gtfs.org/schedule/reference/#stop_timestxt
 */
export enum PickupDropOffType {
  REGULAR = 0,
  NONE = 1,
  PHONE_AGENCY = 2,
  COORDINATE_WITH_DRIVER = 3,
}
