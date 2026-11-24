import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AudioSource,
  AudioStatus,
  MoodTag,
  PostStatus,
  PrismaClient,
  UserRole,
} from '../src/generated/prisma/client.js';

/**
 * Dữ liệu mẫu cho môi trường phát triển.
 * - seed-data/demo-posts.json: nội dung 5 số Radio
 * - seed-data/demo-audio.json: duration + timestamps, sinh bởi
 *   `uv run python -m scripts.generate_demo_radios` (auralis-audio-ai).
 *   File MP3 nằm ở auralis-web/public/demo/radio/<slug>.mp3.
 */

interface DemoPost {
  slug: string;
  title: string;
  summary: string;
  moodTag: keyof typeof MoodTag;
  category: string;
  voice: 'female_warm' | 'male_deep';
  music: string;
  content: string;
}

interface DemoAudio {
  duration: number;
  timestamps: { index: number; start: number; end: number }[];
}

const readJson = <T>(name: string): T =>
  JSON.parse(
    readFileSync(new URL(`./seed-data/${name}`, import.meta.url), 'utf8'),
  ) as T;

const VOICE_NAMES: Record<DemoPost['voice'], string> = {
  female_warm: 'vi-VN-HoaiMyNeural',
  male_deep: 'vi-VN-NamMinhNeural',
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const categories = [
  { name: 'Tản văn', slug: 'tan-van', sortOrder: 1 },
  { name: 'Truyện ngắn', slug: 'truyen-ngan', sortOrder: 2 },
  { name: 'Thư gửi', slug: 'thu-gui', sortOrder: 3 },
  { name: 'Chữa lành', slug: 'chua-lanh', sortOrder: 4 },
  { name: 'Radio đêm', slug: 'radio-dem', sortOrder: 5 },
];

async function main(): Promise<void> {
  const posts = readJson<DemoPost[]>('demo-posts.json');
  const audio = readJson<Record<string, DemoAudio>>('demo-audio.json');

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: category,
    });
  }

  const author = await prisma.user.upsert({
    where: { email: 'tacgia@auralis.local' },
    update: {},
    create: {
      email: 'tacgia@auralis.local',
      username: 'auralis',
      displayName: 'Trạm Auralis',
      role: UserRole.AUTHOR,
      bio: 'Tài khoản tác giả mẫu dùng cho môi trường phát triển.',
    },
  });

  const now = Date.now();
  for (const [index, post] of posts.entries()) {
    const track = audio[post.slug];
    const content = {
      content: post.content,
      timestamps: track?.timestamps,
      wordCount: post.content.split(/\s+/).filter(Boolean).length,
    };
    const data = {
      title: post.title,
      summary: post.summary,
      moodTag: MoodTag[post.moodTag],
      status: PostStatus.PUBLISHED,
      audioUrl: track ? `/demo/radio/${post.slug}.mp3` : null,
      duration: track ? Math.round(track.duration) : null,
      audioSource: track ? AudioSource.AI_EDGE : AudioSource.NONE,
      audioStatus: track ? AudioStatus.READY : AudioStatus.TEXT_ONLY,
      voiceName: VOICE_NAMES[post.voice],
      backgroundMusic: post.music,
      isFeatured: true,
      publishedAt: new Date(now - index * 86_400_000),
      listenCount: 500 - index * 73,
      category: { connect: { slug: post.category } },
    };

    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        ...data,
        content: { upsert: { create: content, update: content } },
      },
      create: {
        ...data,
        slug: post.slug,
        author: { connect: { id: author.id } },
        content: { create: content },
      },
    });
  }

  console.log(
    `Seeded ${categories.length} categories, 1 author, ${posts.length} posts.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
