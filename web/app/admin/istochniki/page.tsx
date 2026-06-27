import { getSources } from "@/lib/queries/admin";
import { SourcesClient } from "./SourcesClient";

export const metadata = { title: "Источники — Админка" };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await getSources();
  return <SourcesClient sources={sources} />;
}
