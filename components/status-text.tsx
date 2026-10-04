import { BadgeCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { AffordabilityStatus } from "@/lib/types";

export function StatusText({
  status,
  children,
}: {
  status: AffordabilityStatus;
  children: ReactNode;
}) {
  const StatusIcon = {
    comfortable: BadgeCheck,
    tight: TriangleAlert,
    risky: OctagonAlert,
  }[status];

  return (
    <span className={`status-text status-${status}`}>
      <StatusIcon size={17} strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  );
}
