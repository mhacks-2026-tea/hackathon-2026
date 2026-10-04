"use client";

import { useId } from "react";
import type {
  CampusMotif,
  FrontendCampusProfile,
} from "@/lib/frontend/campus-types";

export function CampusMotifShape({ kind }: { kind: CampusMotif }) {
  switch (kind) {
    case "football":
      return <><ellipse cx="14" cy="14" rx="10" ry="6" transform="rotate(-28 14 14)" /><path d="m11 14 6-3m-4 5 6-3m-9 1 1 2" /></>;
    case "tent":
      return <><path d="m2 23 12-19 12 19H2Z" /><path d="m10 23 4-8 4 8M4 19h20" /></>;
    case "state":
      return <path d="m6 3 14 1 1 6-2 4 2 5-5 1-2 5-5-2-3-6 2-5-4-4 2-5Z" />;
    case "pennant":
      return <><path d="M6 25V3" /><path d="M7 4h16l-7 7 7 6H7" /></>;
    case "board":
      return <><rect x="7" y="3" width="14" height="22" rx="2" /><circle cx="11" cy="9" r="1" /><circle cx="17" cy="9" r="1" /><circle cx="11" cy="15" r="1" /><circle cx="17" cy="15" r="1" /></>;
    case "cheese":
      return <><path d="m3 19 20-12 2 15H3v-3Z" /><circle cx="13" cy="17" r="1.5" /><circle cx="20" cy="19" r="1" /></>;
    case "chair":
      return <><path d="M8 14h13l2 6H9l-2-6V6a2 2 0 0 1 4 0v6" /><path d="m11 20-2 5m11-5 2 5M5 5 3 3m10-1V0m9 5 2-2" /></>;
    case "capitol":
      return <><path d="M3 11h22M5 11v11m4-11v11m6-11v11m4-11v11m4-11v11M3 23h22" /><path d="M5 9a9 9 0 0 1 18 0m-9-9v3" /></>;
    case "sailboat":
      return <><path d="M13 3v17H4L13 3Zm2 5 8 12h-8V8Z" /><path d="M3 23q4 3 8 0t9 0q2 1 4 0" /></>;
    case "helmet":
      return <><path d="M4 17a10 10 0 0 1 20 0v3H8a4 4 0 0 1-4-3Z" /><path d="M8 20v3h11v-3m-5-13v7" /></>;
    case "tower":
      return <><path d="M8 25V10h12v15M6 10h16L14 2 6 10Z" /><path d="M11 14h2m2 0h2m-6 4h2m2 0h2" /></>;
    case "river":
      return <><path d="M2 8q4-4 8 0t8 0q3-3 6-1M2 15q4-4 8 0t8 0q3-3 6-1M2 22q4-4 8 0t8 0q3-3 6-1" /></>;
    case "pin":
      return <><path d="M14 25s8-9 8-15a8 8 0 1 0-16 0c0 6 8 15 8 15Z" /><circle cx="14" cy="10" r="2.5" /></>;
    case "ivy":
      return <><path d="M14 24c-1-9 1-16 8-21 2 9-1 16-8 21Z" /><path d="M14 24C6 21 4 15 5 8c7 2 10 8 9 16Z" /><path d="m7 11 7 11m7-15-7 15" /></>;
    case "book":
      return <><path d="M3 6q6-3 11 2 5-5 11-2v15q-6-3-11 2-5-5-11-2V6Z" /><path d="M14 8v15" /></>;
    case "arch":
      return <><path d="M4 25V13a10 10 0 0 1 20 0v12M9 25V13a5 5 0 0 1 10 0v12M2 25h24" /></>;
    case "oar":
      return <><path d="m6 24 13-19" /><path d="M17 6q2-4 6-3 1 4-3 7l-3-4ZM5 22l3 2-3 2-2-2 2-2Z" /></>;
    case "connecticut":
      return <path d="m3 8 5-2 4 2 4-3 3 3 6-1-2 7 2 3-5 1-4 6-5-3-6 1 1-6-3-4Z" />;
    case "bison":
      return <><path d="M4 13 2 9l5 1 3-4h9l4 4 3 1-2 5-4 2-3 5h-3l-1-5h-4l-2 5H7l1-7-4-3Z" /><path d="m18 8 3-3 2 2m-17 2L4 6" /></>;
    case "drum":
      return <><ellipse cx="14" cy="8" rx="9" ry="4" /><path d="M5 8v12c0 5 18 5 18 0V8M5 13c0 5 18 5 18 0m-9-4v10" /></>;
    case "trumpet":
      return <><path d="M3 12h9l10-5v10l-10-5H3v8H1V9h2v3Z" /><path d="M12 12v4m4-6v7" /></>;
    case "monument":
      return <><path d="M13 2h2v3h-2zM11 5h6l-1 3h-4l-1-3ZM9 8h10v15H9zM6 23h16v2H6z" /><path d="M12 12h4v7h-4z" /></>;
  }
}

export function SchoolMark({
  campus,
  variant = "badge",
  className,
}: {
  campus: FrontendCampusProfile;
  variant?: "badge" | "hero";
  className?: string;
}) {
  const id = useId().replaceAll(":", "");
  const patternId = `school-pattern-${id}`;
  const clipId = `school-letter-${id}`;
  const motifs = campus.markMotifs;
  const letterSize = variant === "hero" ? 86 : 78;

  return (
    <svg
      aria-hidden="true"
      className={className}
      data-variant={variant}
      focusable="false"
      role="presentation"
      viewBox="0 0 100 100"
    >
      <defs>
        <pattern height="34" id={patternId} patternUnits="userSpaceOnUse" width="34">
          {motifs.slice(0, 6).map((motif, index) => (
            <g
              key={`${motif}-${index}`}
              transform={`translate(${(index % 2) * 17} ${Math.floor(index / 2) * 11}) scale(.58)`}
              fill="none"
              stroke={index % 2 ? campus.theme.accent : campus.theme.primary}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
            >
              <CampusMotifShape kind={motif} />
            </g>
          ))}
        </pattern>
        <clipPath id={clipId}>
          <text
            dominantBaseline="central"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={letterSize}
            fontWeight="900"
            textAnchor="middle"
            x="50"
            y="53"
          >
            {campus.markLetter}
          </text>
        </clipPath>
      </defs>
      <rect
        fill={variant === "hero" ? campus.theme.surface : campus.theme.primary}
        height="100"
        rx={variant === "hero" ? 14 : 12}
        width="100"
      />
      <rect
        clipPath={`url(#${clipId})`}
        fill={`url(#${patternId})`}
        height="100"
        width="100"
      />
      <text
        dominantBaseline="central"
        fill="none"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize={letterSize}
        fontWeight="900"
        stroke={variant === "hero" ? campus.theme.foreground : campus.theme.textOnPrimary}
        strokeOpacity={variant === "hero" ? 0.65 : 0.45}
        strokeWidth={variant === "hero" ? 0.65 : 1.2}
        textAnchor="middle"
        x="50"
        y="53"
      >
        {campus.markLetter}
      </text>
    </svg>
  );
}
