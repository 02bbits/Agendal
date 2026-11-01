import { now, timeZone } from "../lib/clock";
import type { Clock } from "../ui";

export const appClock: Clock = {
  now,
  get timeZone() {
    return timeZone();
  },
};
