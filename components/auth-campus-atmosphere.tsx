"use client";

import { useId } from "react";
import { CampusMotifShape } from "@/components/school-mark";
import { campusProfiles } from "@/lib/mock-data";
import type { CampusId } from "@/lib/frontend/campus-types";

const stateOutlines: Record<CampusId, string> = {
  michigan: "M3 3 8 5 10 11 15 15 13 20 9 18 7 14 4 12 5 8Z M17 5 22 4 26 7 29 6 28 10 25 12 23 17 20 20 18 16 19 12 16 9Z",
  wisconsin: "M7 3 23 4 22 8 27 11 24 16 25 21 19 25 17 29 12 26 8 27 9 23 5 20 7 16 4 13 7 10Z",
  "michigan-state": "M3 3 8 5 10 11 15 15 13 20 9 18 7 14 4 12 5 8Z M17 5 22 4 26 7 29 6 28 10 25 12 23 17 20 20 18 16 19 12 16 9Z",
  yale: "M4 7 9 4 14 6 19 3 28 6 26 11 28 15 23 18 21 24 16 26 11 23 7 24 8 19 4 16 6 12Z",
  howard: "M8 3 24 3 28 7 26 11 29 15 25 18 24 25 19 27 14 24 9 26 7 21 4 18 6 13 3 9Z",
};

const motifsByCampus = {
  michigan: ["helmet", "football"],
  wisconsin: ["cheese", "sailboat"],
  "michigan-state": ["helmet", "tower"],
  yale: ["book", "ivy"],
  howard: ["bison", "drum"],
} as const;

export function AuthCampusAtmosphere() {
  const id = `auth-campus-atmosphere-${useId().replaceAll(":", "")}`;

  return (
    <svg
      aria-hidden="true"
      className="auth-campus-atmosphere"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1440 900"
    >
      <defs>
        <pattern
          height="156"
          id={id}
          patternTransform="rotate(-22)"
          patternUnits="userSpaceOnUse"
          width="248"
        >
          {campusProfiles.flatMap((campus, index) => {
            const motifs = motifsByCampus[campus.id];
            const x = 4 + (index % 2) * 120;
            const y = 2 + Math.floor(index / 2) * 48;
            return [
              <g
                key={`${campus.id}-state`}
                transform={`translate(${x} ${y})`}
                fill="none"
                stroke="#ffdf45"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.35"
              >
                <path d={stateOutlines[campus.id]} transform="scale(1.45)" />
              </g>,
              ...motifs.map((kind, motifIndex) => (
                <g
                  key={`${campus.id}-${kind}`}
                  transform={`translate(${x + 46 + motifIndex * 28} ${y + (motifIndex % 2 ? 12 : 0)}) scale(1.1)`}
                  fill="none"
                  stroke="#ffdf45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                >
                  <CampusMotifShape kind={kind} />
                </g>
              )),
            ];
          })}
        </pattern>
        <radialGradient id={`${id}-fade`} cx="50%" cy="42%" r="78%">
          <stop offset="0" stopColor="white" stopOpacity=".28" />
          <stop offset="1" stopColor="white" stopOpacity=".08" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect fill={`url(#${id}-fade)`} height="100%" width="100%" />
        </mask>
      </defs>
      <rect fill={`url(#${id})`} height="100%" mask={`url(#${id}-mask)`} width="100%" />
    </svg>
  );
}
