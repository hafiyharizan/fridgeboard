import { Building2, House, MapPin } from "lucide-react";
import { placeLabel } from "@/lib/work";
import type { WorkShift } from "@/lib/types";

export const PLACE_ICON = { office: Building2, home: House, other: MapPin } as const;

/** Where a shift happens ("Office", "Work from home", or the named location); nothing if it doesn't say. */
export function WorkPlaceChip({ shift, size = 13 }: { shift: Pick<WorkShift, "work_place" | "location">; size?: number }) {
  const label = placeLabel(shift);
  if (!label) return null;
  const Icon = PLACE_ICON[shift.work_place ?? "office"];
  return (
    <span className={`work-place is-${shift.work_place}`}>
      <Icon size={size} aria-hidden />
      {label}
    </span>
  );
}
