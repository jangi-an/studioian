import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/", url.origin));
    } catch {
      // Show a recoverable message without exposing authentication data.
    }
  }
  return NextResponse.redirect(new URL("/?auth_error=1", url.origin));
}
