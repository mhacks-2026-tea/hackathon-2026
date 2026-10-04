import { campusProfiles } from "@/lib/mock-data";
import { getCampusProfile } from "@/lib/frontend/campus-data";
import type {
  CampusId,
  Listing,
  ListingFilters,
  ListingProvider,
} from "@/lib/frontend/campus-types";
import { estimateHousingScenario } from "@/lib/data/dashboard";
import type { AffordabilityResult } from "@/lib/types";

export interface ListingWithEstimate {
  listing: Listing;
  estimate: AffordabilityResult;
}

const pause = (duration: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, duration));

function matchesFilters(listing: Listing, filters?: ListingFilters): boolean {
  return (
    (!filters?.propertyType || listing.propertyType === filters.propertyType) &&
    (!filters?.neighborhood || listing.neighborhood === filters.neighborhood) &&
    (filters?.minRent === undefined || listing.rent >= filters.minRent) &&
    (filters?.maxRent === undefined || listing.rent <= filters.maxRent)
  );
}

class MockListingProvider implements ListingProvider {
  async getListings(
    campusId: CampusId,
    filters?: ListingFilters,
  ): Promise<Listing[]> {
    await pause(120);
    return getCampusProfile(campusId).listings.filter((listing) =>
      matchesFilters(listing, filters),
    );
  }

  async getSimilarListings(listingId: string): Promise<Listing[]> {
    await pause(80);
    const campus = campusProfiles.find((profile) =>
      profile.listings.some((listing) => listing.id === listingId),
    );
    const selected = campus?.listings.find((listing) => listing.id === listingId);
    if (!campus || !selected) {
      throw new RangeError(`Unknown listing "${listingId}".`);
    }
    return campus.listings
      .filter(
        (listing) =>
          listing.id !== listingId &&
          listing.propertyType === selected.propertyType &&
          listing.neighborhood !== selected.neighborhood &&
          Math.abs(listing.rent - selected.rent) <= 250,
      )
      .slice(0, 3);
  }
}

const listingProvider: ListingProvider = new MockListingProvider();

export function getListings(
  campusId: CampusId,
  filters?: ListingFilters,
): Promise<Listing[]> {
  return listingProvider.getListings(campusId, filters);
}

export function getSimilarListings(listingId: string): Promise<Listing[]> {
  return listingProvider.getSimilarListings(listingId);
}

export async function getListingEstimates(listings: Listing[], campusId: CampusId): Promise<ListingWithEstimate[]> {
  return Promise.all(listings.map(async listing => ({ listing, estimate: (await estimateHousingScenario({ monthlyRent: listing.rent, roommates: 0 }, { campus: getCampusProfile(campusId) })).result })));
}
