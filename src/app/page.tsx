import { connection } from "next/server";
import { Suspense } from "react";
import { TeamDashboard } from "@/components/pages/TeamDashboard";
import { dbConfigured } from "@/lib/db";
import { listTeams } from "@/lib/groups/server";

async function DashboardWithTeams() {
  await connection();
  const initialTeams = dbConfigured()
    ? await listTeams().catch((e) => {
        console.error("[db] pre-fetch teams error:", (e as Error)?.message);
        return null;
      })
    : null;

  return <TeamDashboard initialTeams={initialTeams} />;
}

export default function Home() {
  return (
    <Suspense>
      <DashboardWithTeams />
    </Suspense>
  );
}
