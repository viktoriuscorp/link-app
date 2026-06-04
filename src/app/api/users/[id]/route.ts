import { NextResponse } from "next/server";
import { requireCurrentUser, updatePrivateUser } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireCurrentUser().catch(() => null);
  if (!currentUser) {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  if (currentUser.role !== "owner") {
    return NextResponse.json({ message: "Solo un owner puede editar usuarios." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const payload = updateUserSchema.parse(body);
    const user = await updatePrivateUser(id, payload);

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo editar el usuario." },
      { status: 400 }
    );
  }
}
