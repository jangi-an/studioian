import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { error } = await supabase.auth.getSession();

  const connected = !error;

  return (
    <main style={{ fontFamily: "sans-serif", padding: "3rem" }}>
      <h1>Studio Ian</h1>
      <p>
        Supabase connection:{" "}
        <strong style={{ color: connected ? "green" : "red" }}>
          {connected ? "OK" : "실패"}
        </strong>
      </p>
      {error && <pre>{error.message}</pre>}
    </main>
  );
}
