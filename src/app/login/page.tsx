"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"password" | "magic">("magic");
  const router = useRouter();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your email for a sign-in link.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F8F8]">
      <form
        onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-[#E8E8E8] bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-[#1A1A1A]">Sign in to Verarca</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] px-4 py-2 text-[#1A1A1A] placeholder-[#8A8A8A] focus:border-[#FF6B4A] focus:outline-none"
        />

        {mode === "password" && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-[#E8E8E8] bg-[#F8F8F8] px-4 py-2 text-[#1A1A1A] placeholder-[#8A8A8A] focus:border-[#FF6B4A] focus:outline-none"
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#FF6B4A] px-4 py-2 font-medium text-white transition-colors hover:bg-[#E85A3A] disabled:opacity-50"
        >
          {loading
            ? "Sending..."
            : mode === "password"
              ? "Sign in"
              : "Send magic link"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "magic" : "password");
            setError(null);
            setMessage(null);
          }}
          className="w-full text-sm text-[#8A8A8A] hover:text-[#1A1A1A] transition-colors"
        >
          {mode === "password"
            ? "Sign in with magic link instead"
            : "Sign in with password instead"}
        </button>
      </form>
    </div>
  );
}
