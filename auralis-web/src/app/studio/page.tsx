import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { StudioDashboard } from "@/components/studio/studio-dashboard";

export const metadata: Metadata = { title: "Studio của tôi" };

export default function StudioPage(props: PageProps<"/studio">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Creator Studio</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Studio của tôi</h1>
      <div className="mt-8">
        <RequireAuth>
          <Suspense>
            <Dashboard searchParams={props.searchParams} />
          </Suspense>
        </RequireAuth>
      </div>
    </div>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/studio">, "searchParams">) {
  const params = await searchParams;
  return <StudioDashboard justSubmitted={params["da-gui"] === "1"} />;
}
