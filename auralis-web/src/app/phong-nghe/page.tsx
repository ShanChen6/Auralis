import type { Metadata } from "next";
import { LiveRoomList } from "@/components/live/live-room-list";

export const metadata: Metadata = { title: "Phòng nghe chung" };

export default function LiveRoomsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Nghe cùng nhau</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Phòng nghe chung</h1>
      <p className="mt-3 mb-8 max-w-2xl text-muted">
        Cùng nghe một số Radio vào cùng một khoảnh khắc, trò chuyện và gửi nhau một tách trà ấm.
      </p>
      <LiveRoomList />
    </div>
  );
}
