"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { StatusText } from "@/components/status-text";
import {
  getListingEstimates,
  getListings,
  getSimilarListings,
  type ListingWithEstimate,
} from "@/lib/frontend/listings";
import type {
  FrontendCampusProfile,
  Listing,
  ListingPropertyType,
} from "@/lib/frontend/campus-types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(amount: number): string {
  return currency.format(amount);
}

const propertyLabels: Record<ListingPropertyType, string> = {
  house: "House",
  duplex: "Duplex",
  apartment: "Apartment building",
  studio: "Studio / loft",
};

function PropertyIllustration({
  propertyType,
  campus,
}: {
  propertyType: ListingPropertyType;
  campus: FrontendCampusProfile;
}) {
  const primary = campus.theme.primary;
  const accent = campus.theme.accent;
  const line = campus.theme.borderStrong;
  return (
    <svg aria-hidden="true" className="listing-illustration" viewBox="0 0 320 180">
      <rect width="320" height="180" fill={campus.theme.surfaceSoft} />
      <circle cx="257" cy="43" r="22" fill={accent} opacity=".5" />
      <path d="M0 143q65-23 128 0t128 0q32-12 64-2v39H0Z" fill={accent} opacity=".18" />
      {propertyType === "house" && (
        <g>
          <path d="m74 93 86-62 86 62v61H74Z" fill={campus.theme.surface} stroke={line} strokeWidth="4" />
          <path d="m61 94 99-73 99 73" fill="none" stroke={primary} strokeWidth="9" strokeLinejoin="round" />
          <path d="M143 154v-42h34v42M95 105h29v27H95Zm101 0h29v27h-29Z" fill={accent} opacity=".6" stroke={line} strokeWidth="3" />
        </g>
      )}
      {propertyType === "duplex" && (
        <g>
          <path d="m49 91 55-42 55 42v63H49Zm112 0 55-42 55 42v63h-110Z" fill={campus.theme.surface} stroke={line} strokeWidth="4" />
          <path d="m40 91 64-50 64 50m-7 0 55-42 63 42" fill="none" stroke={primary} strokeWidth="8" strokeLinejoin="round" />
          <path d="M82 112h28v27H82Zm58 0h28v27h-28Zm58 0h28v27h-28Z" fill={accent} opacity=".65" />
        </g>
      )}
      {propertyType === "apartment" && (
        <g>
          <path d="M88 43h144v111H88Z" fill={campus.theme.surface} stroke={line} strokeWidth="4" />
          <path d="M78 44h164V30H78Z" fill={primary} />
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3].map((column) => (
              <rect key={`${row}-${column}`} x={104 + column * 31} y={61 + row * 27} width="17" height="17" rx="2" fill={accent} opacity=".72" />
            )),
          )}
          <path d="M145 125h28v29h-28Z" fill={primary} opacity=".75" />
        </g>
      )}
      {propertyType === "studio" && (
        <g>
          <path d="m69 86 91-62 91 62v68H69Z" fill={campus.theme.surface} stroke={line} strokeWidth="4" />
          <path d="m58 87 102-72 102 72" fill="none" stroke={primary} strokeWidth="9" strokeLinejoin="round" />
          <path d="M107 97h106v57H107Z" fill={accent} opacity=".3" stroke={line} strokeWidth="3" />
          <path d="M159 98v56m-52-28h106" stroke={line} strokeWidth="3" />
        </g>
      )}
      <path d="M0 155h320" stroke={line} strokeWidth="3" opacity=".7" />
    </svg>
  );
}

export function ListingImage({
  listing,
  campus,
}: {
  listing: Listing;
  campus: FrontendCampusProfile;
}) {
  const [failed, setFailed] = useState(false);
  const src = listing.photoUrls[0];

  return (
    <div
      className="listing-image"
      role="img"
      aria-label={`Representative ${propertyLabels[listing.propertyType].toLowerCase()} photo near ${listing.neighborhood}; not the exact property`}
    >
      {src && !failed ? (
        // Remote photo hosts will need to be allowed in next.config.* when real listings are connected.
        <Image
          alt={`Representative home photo near ${listing.neighborhood}, not the exact property`}
          height={180}
          loading="lazy"
          onError={() => setFailed(true)}
          src={src}
          unoptimized
          width={320}
        />
      ) : (
        <PropertyIllustration campus={campus} propertyType={listing.propertyType} />
      )}
      <span className="listing-image-label">Representative photo</span>
    </div>
  );
}

function ListingCard({
  item,
  campus,
}: {
  item: ListingWithEstimate;
  campus: FrontendCampusProfile;
}) {
  const { listing, estimate } = item;
  const query = new URLSearchParams({
    campus: campus.id,
    rent: String(listing.rent),
    roommates: "0",
  });
  const [similar, setSimilar] = useState<Listing[]>([]);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  async function toggleSimilar() {
    if (similarOpen) {
      setSimilarOpen(false);
      return;
    }
    if (similar.length) {
      setSimilarOpen(true);
      return;
    }
    setLoadingSimilar(true);
    setSimilarError(null);
    try {
      setSimilar(await getSimilarListings(listing.id));
      setSimilarOpen(true);
    } catch (reason: unknown) {
      setSimilarError(reason instanceof Error ? reason.message : "Similar homes couldn’t be loaded.");
    } finally {
      setLoadingSimilar(false);
    }
  }

  return (
    <article className="listing-card">
      <ListingImage campus={campus} listing={listing} />
      <div className="listing-card-content">
        <p className="listing-address">{listing.address}</p>
        <p className="listing-details">
          {propertyLabels[listing.propertyType]} ·{" "}
          {listing.beds === 0 ? "Studio" : `${listing.beds} beds`} · {listing.baths} bath
          {listing.baths === 1 ? "" : "s"} · {listing.neighborhood}
        </p>
        <p className="listing-rent">{formatMoney(listing.rent)} <span>advertised rent / mo</span></p>
        <div className="listing-estimate">
          <div><span>True monthly cost</span><strong>{formatMoney(estimate.trueMonthlyCost)}</strong></div>
          <div><span>Left after housing</span><strong>{formatMoney(estimate.monthlyRemaining)}</strong></div>
          <StatusText status={estimate.status}>
            {estimate.status === "comfortable" ? "Comfortable" : estimate.status === "tight" ? "Tight" : "Higher risk"}
          </StatusText>
        </div>
        <p className="listing-commute">
          {listing.commuteMinutes} min to campus · {campus.transit}
        </p>
        <details className="listing-breakdown">
          <summary>See cost breakdown</summary>
          <dl>
            {Object.entries(estimate.breakdown)
              .filter(([key]) => key !== "total")
              .map(([key, value]) => (
                <div key={key}><dt>{key[0].toUpperCase() + key.slice(1)}</dt><dd>{formatMoney(value)}</dd></div>
              ))}
            <div><dt>True monthly cost</dt><dd>{formatMoney(estimate.trueMonthlyCost)}</dd></div>
          </dl>
        </details>
        <div className="listing-actions">
          <Link className="listing-use-rent" href={`/dashboard?${query.toString()}`}>
            Use this rent <ArrowRight size={15} aria-hidden="true" />
          </Link>
          {listing.sourceUrl && listing.sourceName && (
            <a href={listing.sourceUrl} rel="noopener noreferrer" target="_blank">
              View on {listing.sourceName}
            </a>
          )}
        </div>
        <button className="listing-similar-toggle" onClick={() => void toggleSimilar()} type="button">
          {loadingSimilar ? "Finding similar homes…" : similarOpen ? "Hide similar homes" : "Similar homes nearby"}
        </button>
        {similarError && <p className="listing-error" role="alert">{similarError}</p>}
        {similarOpen && (
          <div className="listing-similar-list">
            {similar.map((listing) => (
              <div className="listing-similar-item" key={listing.id}>
                <div className="listing-similar-image">
                  <ListingImage campus={campus} listing={listing} />
                </div>
                <div className="listing-similar-details">
                  <strong>{listing.address}</strong>
                  <span>{listing.neighborhood} · {formatMoney(listing.rent)}/mo</span>
                </div>
              </div>
            ))}
            {similar.length === 0 && <p>No similar homes nearby yet.</p>}
          </div>
        )}
      </div>
    </article>
  );
}

export function ListingCards({
  campus,
}: {
  campus: FrontendCampusProfile;
}) {
  const [items, setItems] = useState<ListingWithEstimate[]>([]);
  const [propertyType, setPropertyType] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadListings() {
      try {
        const listings = await getListings(campus.id, {
          propertyType: isListingPropertyType(propertyType) ? propertyType : undefined,
        });
        if (active) {
          setItems(getListingEstimates(listings, campus.id));
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Homes couldn’t be loaded.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadListings();
    return () => {
      active = false;
    };
  }, [campus.id, propertyType, retryKey]);

  return (
    <section className="listing-section" aria-label={`Homes near ${campus.name}`}>
      <div className="listing-section-heading">
        <div>
          <h2>Homes near {campus.shortName}</h2>
          <p>Sample homes and rents. Photos are representative, not the exact properties.</p>
        </div>
        <label>
          <span className="sr-only">Filter by home type</span>
          <select
            onChange={(event) => {
              setIsLoading(true);
              setPropertyType(event.target.value);
            }}
            value={propertyType}
          >
            <option value="">All home types</option>
            {Object.entries(propertyLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {isLoading ? (
        <div className="listing-grid" aria-label="Loading homes" aria-busy="true">
          {[0, 1, 2].map((key) => <div className="listing-skeleton" key={key} />)}
        </div>
      ) : error ? (
        <div className="listing-empty" role="alert">
          <p>{error}</p>
          <button
            onClick={() => {
              setIsLoading(true);
              setRetryKey((current) => current + 1);
            }}
            type="button"
          >
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="listing-empty">
          <p>No homes match these filters yet.</p>
          <button
            onClick={() => {
              setIsLoading(true);
              setPropertyType("");
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="listing-grid">
          {items.slice(0, 4).map((item) => (
            <ListingCard campus={campus} item={item} key={item.listing.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function isListingPropertyType(value: string): value is ListingPropertyType {
  return Object.hasOwn(propertyLabels, value);
}
