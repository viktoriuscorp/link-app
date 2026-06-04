import { NextResponse } from "next/server";
import { createPrivateUser, listUsers, requireCurrentUser } from "@/lib/auth";
import { createUserSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireCurrentUser();
    const users = await listUsers();
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const currentUser = await requireCurrentUser().catch(() => null);
  if (!currentUser) {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "owner") {
    return NextResponse.json({ message: "Solo un owner puede crear usuarios." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = createUserSchema.parse(body);
    const user = await createPrivateUser({
      ...payload,
      workspaceName: currentUser.workspaceName
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo crear el usuario." },
      { status: 400 }
    );
  }
}
