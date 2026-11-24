"use client";

import { CalendarClock, Loader2, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CoverArt } from "@/components/radio/cover-art";
import { Alert } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import type { LiveRoomState } from "@/lib/live";

export function LiveRoomList() {
  const [rooms, setRooms] = useState<LiveRoomState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api<LiveRoomState[]>("/live-rooms")
        .then((r) => {
          setRooms(r);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    void load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  if (error && !rooms) return <Alert>{error}</Alert>;
  if (!rooms) {
    return (
      <div className="flex justify-center py-16 text-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {rooms.map((room) => (
        <Link key={room.id} href={`/phong-nghe/${room.slug}`} className="group glass flex gap-5 rounded-[28px] p-4 transition-colors hover:border-primary/30">
          <div className="size-28 shrink-0 overflow-hidden rounded-3xl">
            {room.track ? (
              <CoverArt slug={room.track.slug} mood={room.track.moodTag} coverUrl={room.track.coverUrl} title={room.track.title} className="transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="flex size-full items-center justify-center bg-surface-strong text-secondary">
                <CalendarClock className="size-8" />
              </div>
            )}
          </div>
          <div className="min-w-0 py-1">
            {room.status === "LIVE" ? (
              <span className="flex items-center gap-1.5 text-xs font-medium tracking-widest text-rose-300 uppercase">
                <Radio className="size-3.5" /> Trực tiếp
              </span>
            ) : (
              <span className="text-xs tracking-widest text-secondary uppercase">Sắp lên sóng</span>
            )}
            <h2 className="mt-1 font-serif text-xl text-foreground">{room.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {room.track ? `Đang phát: ${room.track.title}` : room.description}
            </p>
            {room.status === "LIVE" && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Users className="size-3.5" />
                {room.listeners} người đang nghe
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
