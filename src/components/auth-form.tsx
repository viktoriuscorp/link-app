"use client";

import { ArrowRight, Link2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    workspaceName: "My Workspace",
    email: "",
    password: ""
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message);
      }

      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <Link2 size={21} strokeWidth={2.4} />
          </span>
          <div>
            <h1>Link App</h1>
            <p>{mode === "login" ? "Accede a tu workspace" : "Crea tu workspace"}</p>
          </div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <>
              <label>
                Nombre
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Workspace
                <input
                  required
                  value={form.workspaceName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, workspaceName: event.target.value }))
                  }
                />
              </label>
            </>
          ) : null}
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            Contrasena
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "No tienes cuenta?" : "Ya tienes cuenta?"}{" "}
          <Link href={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Registrate" : "Inicia sesion"}
          </Link>
        </p>
      </section>
    </main>
  );
}
