import { MovinDashboard } from "@/components/movin-dashboard";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;
  return <MovinDashboard initialPrompt={prompt} view="ask" />;
}
