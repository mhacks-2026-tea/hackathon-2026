"use client";

import { useId } from "react";
import { CampusMotifShape } from "@/components/school-mark";
import type { FrontendCampusProfile } from "@/lib/frontend/campus-types";

const stateOutlines: Record<FrontendCampusProfile["id"], string> = {
  michigan: "M3 3 8 5 10 11 15 15 13 20 9 18 7 14 4 12 5 8Z M17 5 22 4 26 7 29 6 28 10 25 12 23 17 20 20 18 16 19 12 16 9Z",
  wisconsin: "M7 3 23 4 22 8 27 11 24 16 25 21 19 25 17 29 12 26 8 27 9 23 5 20 7 16 4 13 7 10Z",
  "michigan-state": "M3 3 8 5 10 11 15 15 13 20 9 18 7 14 4 12 5 8Z M17 5 22 4 26 7 29 6 28 10 25 12 23 17 20 20 18 16 19 12 16 9Z",
  yale: "M4 7 9 4 14 6 19 3 28 6 26 11 28 15 23 18 21 24 16 26 11 23 7 24 8 19 4 16 6 12Z",
  howard: "M8 3 24 3 28 7 26 11 29 15 25 18 24 25 19 27 14 24 9 26 7 21 4 18 6 13 3 9Z",
};

export function CampusAtmosphere({ campus }: { campus: FrontendCampusProfile }) {
  const patternId = `campus-pattern-${useId().replaceAll(":", "")}`;
  const motifsByCampus = {
    michigan: ["helmet", "football", "pennant", "tent", "state", "board", "pin", "river"],
    wisconsin: ["cheese", "sailboat", "capitol", "chair", "river", "book", "pennant", "state"],
    "michigan-state": ["helmet", "tower", "football", "river", "pin", "pennant", "state", "tent"],
    yale: ["book", "ivy", "arch", "oar", "connecticut", "tower", "river", "pennant"],
    howard: ["bison", "drum", "monument", "trumpet", "capitol", "book", "pennant", "state"],
  } as const;
  const motifs = motifsByCampus[campus.id];

  return (
    <svg
      aria-hidden="true"
      className="campus-atmosphere"
      focusable="false"
      preserveAspectRatio="xMidYMin slice"
      viewBox="0 0 1120 840"
    >
      <defs>
        <pattern
          height="92"
          id={patternId}
          patternTransform="rotate(-24)"
          patternUnits="userSpaceOnUse"
          width="92"
        >
          {Array.from({ length: 25 }, (_, index) => {
            const kind = motifs[index % motifs.length];
            const column = index % 5;
            const row = Math.floor(index / 5);
            if (index === 12 || index === 22) {
              return (
                <g
                  key={`state-outline-${index}`}
                  transform={`translate(${column * 18 + 2} ${row * 18 + 2}) scale(.62)`}
                  fill="none"
                  stroke={campus.theme.accent}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                >
                  <path d={stateOutlines[campus.id]} />
                </g>
              );
            }
            return (
              <g
                key={`motif-${kind}-${index}`}
                transform={`translate(${column * 18 + 2} ${row * 18 + 2}) rotate(${index % 2 ? 8 : -8} 14 14) scale(.54)`}
                fill="none"
                stroke={index % 2 ? campus.theme.accent : campus.theme.primary}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              >
                <CampusMotifShape kind={kind} />
              </g>
            );
          })}
        </pattern>
        <radialGradient id={`${patternId}-fade`} cx="50%" cy="40%" r="78%">
          <stop offset="0" stopColor="white" stopOpacity=".86" />
          <stop offset="1" stopColor="white" stopOpacity=".3" />
        </radialGradient>
        <mask id={`${patternId}-mask`}>
          <rect fill={`url(#${patternId}-fade)`} height="100%" width="100%" />
        </mask>
      </defs>
      <rect
        fill={`url(#${patternId})`}
        height="100%"
        mask={`url(#${patternId}-mask)`}
        width="100%"
      />
    </svg>
  );
}
