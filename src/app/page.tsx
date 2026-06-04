import { Dashboard } from "@/components/dashboard";
import { listApiKeys } from "@/lib/api-keys";
import { getCurrentUser, listUsers } from "@/lib/auth";
import { getSnapshot } from "@/lib/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const snapshot = await getSnapshot();
  const users = await listUsers();
  const apiKeys = await listApiKeys();

  return <Dashboard currentUser={currentUser} initialApiKeys={apiKeys} initialSnapshot={snapshot} initialUsers={users} />;
}
