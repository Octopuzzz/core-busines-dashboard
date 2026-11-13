import { Suspense } from "react";
import { TeamDashboard } from "@/components/pages/TeamDashboard";

// The dashboard depends on "today" (date ranges, overdue), so render it per request.
export default function Home() {
  return (
    <Suspense>
      <TeamDashboard />
    </Suspense>
  );
}
