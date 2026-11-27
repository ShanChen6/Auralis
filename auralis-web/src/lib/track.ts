import type { Track } from "@/store/player";
import type { PostCard } from "./types";

export function toTrack(post: PostCard): Track | null {
  if (!post.audioUrl) return null;
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    artist: post.narrator?.displayName ?? post.author.displayName,
    audioUrl: post.audioUrl,
    duration: post.duration,
    moodTag: post.moodTag,
  };
}

export function toTracks(posts: PostCard[]): Track[] {
  return posts.map(toTrack).filter((t): t is Track => t !== null);
}
