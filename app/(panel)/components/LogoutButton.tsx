"use client";

export default function LogoutButton() {
  async function handle() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button type="button" onClick={handle} className="btn-ghost">
      Salir
    </button>
  );
}
