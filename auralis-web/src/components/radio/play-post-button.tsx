"use client";

import { Pause, Play } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { toTrack, toTracks } from "@/lib/track";
import type { PostCard } from "@/lib/types";
import { usePlayer } from "@/store/player";

/** Nút phát một số Radio; `queue` (nếu có) trở thành danh sách chờ. */
export function PlayPostButton({
  post,
  queue,
  label,
  ...props
}: { post: PostCard; queue?: PostCard[]; label?: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.id === post.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const playing = isCurrent && isPlaying;
  const track = toTrack(post);

  return (
    <Button
      {...props}
      disabled={!track || props.disabled}
      aria-label={label ? undefined : playing ? `Tạm dừng ${post.title}` : `Phát ${post.title}`}
      onClick={() => {
        if (!track) return;
        const player = usePlayer.getState();
        if (isCurrent) player.togglePlay();
        else player.playTrack(track, queue ? toTracks(queue) : undefined);
      }}
    >
      {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
      {label && <span>{playing ? "Tạm dừng" : label}</span>}
    </Button>
  );
}
