import { campusProfiles } from "@/lib/mock-data";
export function getCampusProfile(id: string) {
  const campus = campusProfiles.find(c => c.id === id);
  if (!campus) throw new RangeError("Unknown campus");
  return campus;
}
