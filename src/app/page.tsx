import { Dashboard } from "@/components/dashboard";
import { getSnapshot } from "@/lib/store";

export default async function Home() {
  const snapshot = await getSnapshot();

  return <Dashboard initialSnapshot={snapshot} />;
}
