import type { DashboardData } from "@/lib/types";

export type CampusId =
  | "michigan"
  | "wisconsin"
  | "michigan-state"
  | "yale"
  | "howard";

export interface CampusTheme {
  background: string;
  surface: string;
  surfaceSoft: string;
  foreground: string;
  muted: string;
  mutedStrong: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryDark: string;
  primaryWash: string;
  primaryLight: string;
  textOnPrimary: string;
  accent: string;
  focusRing: string;
  success: string;
  successWash: string;
  warning: string;
  warningWash: string;
  danger: string;
  dangerWash: string;
  chartGrid: string;
  colorScheme: "dark" | "light";
}

export type CampusMotif =
  | "football"
  | "tent"
  | "state"
  | "pennant"
  | "board"
  | "cheese"
  | "chair"
  | "capitol"
  | "sailboat"
  | "helmet"
  | "tower"
  | "river"
  | "pin"
  | "ivy"
  | "book"
  | "arch"
  | "oar"
  | "connecticut"
  | "bison"
  | "drum"
  | "trumpet"
  | "monument";

export interface CampusCalendarEvent {
  month: string;
  label: string;
  kind: "warning" | "move-in" | "positive";
}

export interface CampusNeighborhoodProfile {
  id: string;
  name: string;
  typicalRent: number;
  commute: string;
  note: string;
  studentFit: string;
  propertyTypeMix: string[];
}

export type ListingPropertyType = "house" | "duplex" | "apartment" | "studio";

export interface Listing {
  id: string;
  address: string;
  propertyType: ListingPropertyType;
  beds: number;
  baths: number;
  rent: number;
  photoUrls: string[];
  neighborhood: string;
  commuteMinutes: number;
  sourceUrl?: string;
  sourceName?: string;
}

export interface ListingFilters {
  propertyType?: ListingPropertyType;
  neighborhood?: string;
  minRent?: number;
  maxRent?: number;
}

export interface ListingProvider {
  getListings(campusId: CampusId, filters?: ListingFilters): Promise<Listing[]>;
  getSimilarListings(listingId: string): Promise<Listing[]>;
}

export interface CampusRentBenchmarks {
  low: number;
  typical: number;
  high: number;
}

export interface CampusCostOfLiving {
  utilities: number;
  internet: number;
  insurance: number;
  transportation: number;
  parking: number;
}

export interface FrontendCampusProfile {
  id: CampusId;
  name: string;
  shortName: string;
  city: string;
  state: string;
  term: string;
  termLabel: string;
  markLetter: string;
  markMotifs: CampusMotif[];
  listings: Listing[];
  theme: CampusTheme;
  transit: string;
  rentBenchmarks: CampusRentBenchmarks;
  costOfLiving: CampusCostOfLiving;
  neighborhoods: CampusNeighborhoodProfile[];
  calendar: CampusCalendarEvent[];
  tip: string;
}

export interface CampusDashboardData extends Omit<DashboardData, "campus"> {
  campus: FrontendCampusProfile;
}
