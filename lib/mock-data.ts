import type { FrontendCampusProfile, ListingPropertyType } from "@/lib/frontend/campus-types";

export const campusProfiles: FrontendCampusProfile[] = [
  {
    id: "michigan",
    name: "University of Michigan",
    shortName: "Michigan",
    city: "Ann Arbor",
    state: "MI",
    term: "Fall 2026",
    termLabel: "Fall 2026",
    markLetter: "M",
    markMotifs: ["football", "tent", "state", "pennant", "board", "football"],
    listings: [],
    transit: "TheRide buses",
    tip: "Check your lease start against the summer income gap and fall move-in dates.",
    rentBenchmarks: { low: 850, typical: 1050, high: 1250 },
    costOfLiving: { utilities: 92, internet: 45, insurance: 18, transportation: 121, parking: 0 },
    theme: {
      background: "#1c3152", surface: "#253a5a", surfaceSoft: "#203552",
      foreground: "#f4f1e8", muted: "#bdc9da", mutedStrong: "#d0d8e3",
      border: "#3a4c68", borderStrong: "#526782", primary: "#ffdf45",
      primaryDark: "#f3d22f", primaryWash: "#2a4162", primaryLight: "#99d8f0",
      textOnPrimary: "#17202b", accent: "#99d8f0", focusRing: "#ffdf45",
      success: "#9bdcc0", successWash: "#254b4a", warning: "#f2ad77",
      warningWash: "#4b3b3b", danger: "#ff9b8e", dangerWash: "#533d4c",
      chartGrid: "#3a4c68", colorScheme: "dark",
    },
    neighborhoods: [
      { id: "south-u", name: "South University", typicalRent: 1050, commute: "8 min walk", note: "Close to class, with a lively student scene.", studentFit: "Best for a short walk to class", propertyTypeMix: ["apartment", "studio"] },
      { id: "central-campus", name: "Central Campus", typicalRent: 1120, commute: "5 min walk", note: "A short walk to libraries and lectures.", studentFit: "Best for a car-free routine", propertyTypeMix: ["apartment", "studio"] },
      { id: "kerrytown", name: "Kerrytown", typicalRent: 1180, commute: "14 min walk", note: "Quieter streets and easy access to the market.", studentFit: "Best for a quieter neighborhood", propertyTypeMix: ["house", "duplex"] },
      { id: "old-west-side", name: "Old West Side", typicalRent: 980, commute: "18 min bus", note: "More space, with a longer ride to campus.", studentFit: "Best for more space", propertyTypeMix: ["house", "duplex"] },
    ],
    calendar: [
      { month: "May", label: "Lease planning", kind: "move-in" },
      { month: "Jul", label: "Summer income gap", kind: "warning" },
      { month: "Aug", label: "Security deposit", kind: "move-in" },
      { month: "Sep", label: "Fall refund", kind: "positive" },
    ],
  },
  {
    id: "wisconsin",
    name: "University of Wisconsin-Madison",
    shortName: "Wisconsin",
    city: "Madison",
    state: "WI",
    term: "Fall 2026",
    termLabel: "Fall 2026",
    markLetter: "W",
    markMotifs: ["state", "cheese", "chair", "capitol", "pennant", "sailboat"],
    listings: [],
    transit: "Madison Metro buses",
    tip: "Compare your lease dates with Madison's busy late-summer move-in period.",
    rentBenchmarks: { low: 790, typical: 980, high: 1190 },
    costOfLiving: { utilities: 88, internet: 48, insurance: 18, transportation: 64, parking: 35 },
    theme: {
      background: "#f5f6f8", surface: "#ffffff", surfaceSoft: "#eaedf1",
      foreground: "#202733", muted: "#526070", mutedStrong: "#394655",
      border: "#cbd2db", borderStrong: "#939eac", primary: "#a30d1a",
      primaryDark: "#870916", primaryWash: "#f7e7e8", primaryLight: "#7c1420",
      textOnPrimary: "#ffffff", accent: "#6d1320", focusRing: "#173d70",
      success: "#276446", successWash: "#e5f1e9", warning: "#805000",
      warningWash: "#f8edd8", danger: "#315886", dangerWash: "#e8eef7",
      chartGrid: "#d5dbe2", colorScheme: "light",
    },
    neighborhoods: [
      { id: "state-street", name: "State Street", typicalRent: 1030, commute: "7 min walk", note: "A lively, central spot near campus and Capitol Square.", studentFit: "Best for being in the middle of it all", propertyTypeMix: ["apartment", "studio"] },
      { id: "langdon", name: "Langdon", typicalRent: 1080, commute: "6 min walk", note: "Close to the lake, campus, and student life.", studentFit: "Best for a lakeside campus routine", propertyTypeMix: ["apartment", "duplex"] },
      { id: "regent", name: "Regent", typicalRent: 920, commute: "12 min bus", note: "Residential streets with straightforward bus access.", studentFit: "Best for a quieter shared home", propertyTypeMix: ["house", "duplex"] },
      { id: "vilas", name: "Vilas", typicalRent: 890, commute: "15 min bus", note: "A relaxed neighborhood near parks and campus.", studentFit: "Best for green space and value", propertyTypeMix: ["house", "duplex"] },
    ],
    calendar: [
      { month: "May", label: "Lease planning", kind: "move-in" },
      { month: "Jul", label: "Summer income gap", kind: "warning" },
      { month: "Aug", label: "Madison move-in", kind: "move-in" },
      { month: "Sep", label: "Fall aid arrives", kind: "positive" },
    ],
  },
  {
    id: "michigan-state",
    name: "Michigan State University",
    shortName: "Michigan State",
    city: "East Lansing",
    state: "MI",
    term: "Fall 2026",
    termLabel: "Fall 2026",
    markLetter: "S",
    markMotifs: ["helmet", "tower", "river", "pin", "football", "pennant"],
    listings: [],
    transit: "CATA buses",
    tip: "CATA service makes it worth comparing a bus commute with closer-in rent.",
    rentBenchmarks: { low: 760, typical: 960, high: 1180 },
    costOfLiving: { utilities: 86, internet: 48, insurance: 18, transportation: 52, parking: 30 },
    theme: {
      background: "#102b25", surface: "#193a32", surfaceSoft: "#16342d",
      foreground: "#f4f7f4", muted: "#c0d1ca", mutedStrong: "#d5e2dc",
      border: "#36574e", borderStrong: "#5c786f", primary: "#e7f0eb",
      primaryDark: "#cbded4", primaryWash: "#28483f", primaryLight: "#a9d5c2",
      textOnPrimary: "#17372e", accent: "#ffffff", focusRing: "#f4f7f4",
      success: "#49c9a4", successWash: "#1e5045", warning: "#ffc270",
      warningWash: "#4a4031", danger: "#ff92a1", dangerWash: "#543943",
      chartGrid: "#36574e", colorScheme: "dark",
    },
    neighborhoods: [
      { id: "downtown-east-lansing", name: "Downtown East Lansing", typicalRent: 1020, commute: "6 min walk", note: "A short walk to campus, food, and student services.", studentFit: "Best for a walkable routine", propertyTypeMix: ["apartment", "studio"] },
      { id: "grand-river", name: "Grand River", typicalRent: 990, commute: "8 min walk", note: "Student-focused apartments along the main corridor.", studentFit: "Best for an active student scene", propertyTypeMix: ["apartment", "duplex"] },
      { id: "harrison-road", name: "Harrison Road", typicalRent: 890, commute: "12 min bus", note: "More room with convenient CATA connections.", studentFit: "Best for a shared apartment", propertyTypeMix: ["apartment", "house"] },
      { id: "haslett", name: "Haslett", typicalRent: 850, commute: "22 min bus", note: "A quieter area with more space farther from campus.", studentFit: "Best for a lower-key neighborhood", propertyTypeMix: ["house", "duplex"] },
    ],
    calendar: [
      { month: "May", label: "Lease planning", kind: "move-in" },
      { month: "Jul", label: "Summer income gap", kind: "warning" },
      { month: "Aug", label: "Lease and move-in costs", kind: "move-in" },
      { month: "Sep", label: "Fall aid arrives", kind: "positive" },
    ],
  },
  {
    id: "yale",
    name: "Yale University",
    shortName: "Yale",
    city: "New Haven",
    state: "CT",
    term: "Fall 2026",
    termLabel: "Fall 2026",
    markLetter: "Y",
    markMotifs: ["tower", "ivy", "book", "arch", "oar", "connecticut"],
    listings: [],
    transit: "CTtransit buses",
    tip: "New Haven rents vary by neighborhood; include transit when comparing farther-out options.",
    rentBenchmarks: { low: 1180, typical: 1450, high: 1740 },
    costOfLiving: { utilities: 125, internet: 58, insurance: 20, transportation: 70, parking: 55 },
    theme: {
      background: "#f3f6fa", surface: "#ffffff", surfaceSoft: "#e8edf4",
      foreground: "#17283d", muted: "#52657b", mutedStrong: "#374b62",
      border: "#c8d3e0", borderStrong: "#8799ad", primary: "#00356b",
      primaryDark: "#00284f", primaryWash: "#e5eef8", primaryLight: "#286398",
      textOnPrimary: "#ffffff", accent: "#286398", focusRing: "#005ca8",
      success: "#276446", successWash: "#e5f1e9", warning: "#805000",
      warningWash: "#f8edd8", danger: "#a32843", dangerWash: "#f7e7eb",
      chartGrid: "#d2dce8", colorScheme: "light",
    },
    neighborhoods: [
      { id: "downtown-new-haven", name: "Downtown New Haven", typicalRent: 1540, commute: "7 min walk", note: "Close to campus, restaurants, and the Green.", studentFit: "Best for a car-free routine", propertyTypeMix: ["apartment", "studio"] },
      { id: "east-rock", name: "East Rock", typicalRent: 1480, commute: "18 min bus", note: "Tree-lined streets and popular shared houses.", studentFit: "Best for a neighborhood feel", propertyTypeMix: ["house", "duplex"] },
      { id: "wooster-square", name: "Wooster Square", typicalRent: 1510, commute: "14 min walk", note: "Historic blocks and easy access to downtown.", studentFit: "Best for walkability and local cafes", propertyTypeMix: ["apartment", "duplex"] },
      { id: "westville", name: "Westville", typicalRent: 1280, commute: "25 min bus", note: "More space and a longer ride to campus.", studentFit: "Best for extra space", propertyTypeMix: ["house", "duplex"] },
    ],
    calendar: [
      { month: "May", label: "Summer lease planning", kind: "move-in" },
      { month: "Jul", label: "Summer income gap", kind: "warning" },
      { month: "Aug", label: "New Haven move-in", kind: "move-in" },
      { month: "Sep", label: "Term funding arrives", kind: "positive" },
    ],
  },
  {
    id: "howard",
    name: "Howard University",
    shortName: "Howard",
    city: "Washington",
    state: "DC",
    term: "Fall 2026",
    termLabel: "Fall 2026",
    markLetter: "H",
    markMotifs: ["tower", "bison", "drum", "trumpet", "monument", "book"],
    listings: [],
    transit: "WMATA Metro and buses",
    tip: "Budget for transit and upfront move-in costs when comparing DC neighborhoods.",
    rentBenchmarks: { low: 1150, typical: 1390, high: 1690 },
    costOfLiving: { utilities: 122, internet: 60, insurance: 20, transportation: 105, parking: 90 },
    theme: {
      background: "#111d36", surface: "#1c2b48", surfaceSoft: "#172541",
      foreground: "#f5f5f7", muted: "#bdc9da", mutedStrong: "#d7deea",
      border: "#394963", borderStrong: "#5b6a82", primary: "#e51937",
      primaryDark: "#bf102b", primaryWash: "#442b40", primaryLight: "#a7ccef",
      textOnPrimary: "#ffffff", accent: "#a7ccef", focusRing: "#f5f5f7",
      success: "#56d6b0", successWash: "#204d49", warning: "#ffd07a",
      warningWash: "#4a4031", danger: "#b7a8ff", dangerWash: "#393653",
      chartGrid: "#394963", colorScheme: "dark",
    },
    neighborhoods: [
      { id: "shaw", name: "Shaw", typicalRent: 1460, commute: "12 min Metro", note: "A lively district with a quick trip to campus.", studentFit: "Best for dining and transit", propertyTypeMix: ["apartment", "studio"] },
      { id: "ledroit-park", name: "LeDroit Park", typicalRent: 1330, commute: "8 min walk", note: "Historic homes just steps from campus.", studentFit: "Best for walking to class", propertyTypeMix: ["house", "duplex"] },
      { id: "columbia-heights", name: "Columbia Heights", typicalRent: 1390, commute: "15 min Metro", note: "Metro access, shops, and a wide range of homes.", studentFit: "Best for transit connections", propertyTypeMix: ["apartment", "duplex"] },
      { id: "brookland", name: "Brookland", typicalRent: 1260, commute: "22 min Metro", note: "A quieter residential area on the Red Line.", studentFit: "Best for a calmer commute", propertyTypeMix: ["house", "apartment"] },
    ],
    calendar: [
      { month: "May", label: "DC lease planning", kind: "move-in" },
      { month: "Jul", label: "Summer income gap", kind: "warning" },
      { month: "Aug", label: "Deposit and move-in costs", kind: "move-in" },
      { month: "Sep", label: "Fall aid arrives", kind: "positive" },
    ],
  },
];

const propertyTypes = ["house", "duplex", "apartment", "studio"] as const;
const listingRentOffsets = [-45, 15, 55, 90] as const;
const representativeHomePhotos: Record<ListingPropertyType, string[]> = {
  house: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=80",
  ],
  duplex: [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80",
  ],
  apartment: [
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  ],
  studio: [
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
  ],
};

for (const campus of campusProfiles) {
  campus.listings = campus.neighborhoods.flatMap((neighborhood, index) => {
    const addressNumber = 120 + index * 37;
    const commuteMinutes = Number.parseInt(neighborhood.commute, 10);
    return propertyTypes.flatMap((propertyType, typeIndex) =>
      [0, 1, 2, 3].map((variant) => {
        const rentAdjustment = listingRentOffsets[variant] + (index % 2) * 18;
        return {
          id: `${campus.id}-${neighborhood.id}-${propertyType}-${variant + 1}`,
          address: `${addressNumber + variant * 12 + typeIndex * 5} ${["Maple", "College", "Oak", "Hill"][index]} ${propertyType === "studio" ? "St" : "Ave"}`,
          propertyType,
          beds: propertyType === "studio" ? 0 : 2 + variant,
          baths: propertyType === "house" ? 2 : 1,
          rent: Math.max(500, neighborhood.typicalRent + rentAdjustment),
          photoUrls: [representativeHomePhotos[propertyType][variant % 2]],
          neighborhood: neighborhood.name,
          commuteMinutes: commuteMinutes + variant * 2,
        };
      }),
    );
  });
}

export const mockPrompts = [
  "Can I afford $1,050 rent?",
  "What if I get a roommate?",
  "Why is August tight?",
  "How much should I save before move-in?",
];

