import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveRoom } from "@/components/live/live-room";

export const metadata: Metadata = { title: "Phòng nghe chung" };

/** Phòng mẫu luôn có trong seed – để build được dù API tắt */
export function generateStaticParams() {
  return [{ slug: "tram-dem-mua-22h" }];
}

export default function LiveRoomPage(props: PageProps<"/phong-nghe/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense>
        <RoomBySlug params={props.params} />
      </Suspense>
    </div>
  );
}

async function RoomBySlug({ params }: Pick<PageProps<"/phong-nghe/[slug]">, "params">) {
  const { slug } = await params;
  return <LiveRoom slug={slug} />;
}
