import { CalendarDays, Clock3, Mic2, Music2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoverArt } from "@/components/radio/cover-art";
import { PlayPostButton } from "@/components/radio/play-post-button";
import { SoundscapeMixer } from "@/components/radio/soundscape-mixer";
import { StoryReader } from "@/components/radio/story-reader";
import { getFeaturedPosts, getPost } from "@/lib/api";
import { categoryMoodLabel, formatDate, formatDurationLabel, musicLabel, voiceLabel } from "@/lib/format";

/** Số Radio mẫu luôn có trong seed – dùng khi API tắt lúc build */
const FALLBACK_SLUG = "tram-dem-mua";

export async function generateStaticParams() {
  const featured = await getFeaturedPosts();
  return featured.length ? featured.map((p) => ({ slug: p.slug })) : [{ slug: FALLBACK_SLUG }];
}

export async function generateMetadata({ params }: PageProps<"/radio/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  return post ? { title: post.title, description: post.summary ?? undefined } : { title: "Không tìm thấy" };
}

export default function RadioPage(props: PageProps<"/radio/[slug]">) {
  return (
    <Suspense fallback={<RadioSkeleton />}>
      <RadioDetail params={props.params} />
    </Suspense>
  );
}

async function RadioDetail({ params }: Pick<PageProps<"/radio/[slug]">, "params">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const isAi = post.voiceName?.endsWith("Neural") ?? false;
  const meta = [
    { icon: Mic2, text: post.narrator ? `CTV · ${post.narrator.displayName}` : voiceLabel(post.voiceName, isAi) },
    { icon: Music2, text: musicLabel(post.backgroundMusic) },
    { icon: Clock3, text: formatDurationLabel(post.duration) },
    { icon: CalendarDays, text: formatDate(post.publishedAt) },
  ];

  return (
    <article className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Về trạm
      </Link>

      <header className="mt-6 grid gap-8 md:grid-cols-[220px_1fr] md:items-end">
        <div className="aspect-square w-40 overflow-hidden rounded-[28px] shadow-glow md:w-full">
          <CoverArt slug={post.slug} mood={post.moodTag} coverUrl={post.coverUrl} title={post.title} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-secondary">
            {categoryMoodLabel(post.category?.name, post.moodTag)}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground sm:text-5xl">{post.title}</h1>
          <p className="mt-2 text-muted">
            Viết bởi <span className="text-foreground">{post.author.displayName}</span>
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {meta.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-1.5">
                <Icon className="size-4 text-primary/80" />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <PlayPostButton post={post} label="Nghe số này" size="lg" />
          </div>
        </div>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="max-w-2xl">
          {post.summary && <p className="mb-8 text-lg text-muted italic">{post.summary}</p>}
          <StoryReader post={post} />
          {post.timestamps.length > 0 && (
            <p className="mt-8 text-xs text-muted">Mẹo: bấm vào một đoạn văn để nghe từ đoạn đó.</p>
          )}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SoundscapeMixer />
        </div>
      </div>
    </article>
  );
}

function RadioSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 pt-14 sm:px-6">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <div className="aspect-square w-40 rounded-[28px] bg-surface md:w-full" />
        <div className="space-y-4 self-end">
          <div className="h-4 w-40 rounded bg-surface" />
          <div className="h-12 w-3/4 rounded bg-surface" />
          <div className="h-4 w-1/2 rounded bg-surface" />
        </div>
      </div>
      <div className="mt-12 max-w-2xl space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
