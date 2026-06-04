import { Dashboard } from "@/components/dashboard";
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

  return <Dashboard currentUser={currentUser} initialSnapshot={snapshot} initialUsers={users} />;
}
