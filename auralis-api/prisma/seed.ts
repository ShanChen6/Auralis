import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import {
  AudioSource,
  AudioStatus,
  LiveRoomStatus,
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

  // Tài khoản mẫu cho môi trường phát triển (mật khẩu chỉ dùng local)
  const accounts = [
    {
      email: 'admin@auralis.local',
      username: 'admin',
      displayName: 'Quản trị Auralis',
      role: UserRole.ADMIN,
      password: 'auralis-admin',
    },
    {
      email: 'bientap@auralis.local',
      username: 'bientap',
      displayName: 'Biên tập viên',
      role: UserRole.EDITOR,
      password: 'auralis-editor',
    },
    {
      email: 'tacgia@auralis.local',
      username: 'auralis',
      displayName: 'Trạm Auralis',
      role: UserRole.AUTHOR,
      password: 'auralis-tacgia',
    },
    {
      email: 'giongdoc@auralis.local',
      username: 'giongdoc',
      displayName: 'Giọng Đọc Đêm',
      role: UserRole.AUTHOR,
      password: 'auralis-giongdoc',
    },
  ];
  const users: Record<string, { id: string }> = {};
  for (const { password, ...account } of accounts) {
    const passwordHash = await hashPassword(password);
    users[account.username] = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        role: account.role,
        displayName: account.displayName,
        passwordHash,
      },
      create: {
        ...account,
        passwordHash,
        bio: 'Tài khoản mẫu cho môi trường phát triển.',
      },
      select: { id: true },
    });
  }
  const author = users.auralis;

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

  await seedCommunityPosts(author.id);
  await seedLiveRooms(
    author.id,
    posts.map((p) => p.slug),
  );

  console.log(
    `Seeded ${categories.length} categories, ${accounts.length} accounts, ${posts.length} posts, 3 live rooms.`,
  );
}

/** Một bài chỉ có chữ (chờ cộng đồng lồng tiếng) và một bài đang chờ duyệt */
async function seedCommunityPosts(authorId: string): Promise<void> {
  const textOnly =
    'Sáng nay mình dậy sớm hơn thường lệ. Phố còn vắng, chỉ có tiếng chổi tre của cô lao công và mùi bánh mì nướng từ góc đường.\n\nMình chợt nhận ra, đã lâu lắm rồi mình không đi chậm như thế này. Không vội, không điện thoại, chỉ có mình và buổi sáng.\n\nNếu bạn có một giọng đọc ấm, hãy giúp mình kể lại buổi sáng này nhé.';
  const pending =
    'Có một quán nhỏ ở cuối hẻm, mở cửa từ năm giờ sáng. Bà chủ quán già lắm rồi, nhưng ly cà phê bà pha vẫn đậm như ngày nào.\n\nMỗi sáng, những người khách quen lại ngồi đó, chẳng ai nói với ai câu nào, mà vẫn thấy ấm lòng.';

  const items = [
    {
      slug: 'buoi-sang-di-cham',
      title: 'Buổi sáng đi chậm',
      summary: 'Một buổi sáng không vội vàng, chờ một giọng đọc ấm kể lại.',
      moodTag: MoodTag.CALM,
      status: PostStatus.PUBLISHED,
      content: textOnly,
    },
    {
      slug: 'quan-ca-phe-cuoi-hem',
      title: 'Quán cà phê cuối hẻm',
      summary: 'Bài mẫu đang chờ biên tập viên duyệt.',
      moodTag: MoodTag.NOSTALGIC,
      status: PostStatus.PENDING,
      content: pending,
    },
  ];
  for (const { content, ...item } of items) {
    const data = {
      ...item,
      audioSource: AudioSource.NONE,
      audioStatus: AudioStatus.TEXT_ONLY,
      publishedAt: item.status === PostStatus.PUBLISHED ? new Date() : null,
      category: { connect: { slug: 'tan-van' } },
    };
    const postContent = { content, wordCount: content.split(/\s+/).length };
    await prisma.post.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        ...data,
        author: { connect: { id: authorId } },
        content: { create: postContent },
      },
    });
  }
}

/** Phòng nghe chung: 2 phòng đang phát 24/7 và 1 phòng sắp lên sóng */
async function seedLiveRooms(hostId: string, slugs: string[]): Promise<void> {
  const postIds = Object.fromEntries(
    (
      await prisma.post.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true },
      })
    ).map((p) => [p.slug, p.id]),
  );
  const rooms = [
    {
      slug: 'tram-dem-mua-22h',
      name: 'Trạm Đêm Mưa 22h',
      description: 'Cùng nghe những câu chuyện đêm bên tiếng mưa rơi.',
      status: LiveRoomStatus.LIVE,
      playlist: [
        'tram-dem-mua',
        'mua-hoa-sua-cuoi-pho',
        'gui-nguoi-da-tung-thuong',
      ],
    },
    {
      slug: 'goc-chua-lanh-cuoi-tuan',
      name: 'Góc Chữa Lành Cuối Tuần',
      description: 'Những lời nhắc nhỏ dịu dàng cho tâm hồn mệt mỏi.',
      status: LiveRoomStatus.LIVE,
      playlist: ['on-thoi-roi-se-on', 'chuyen-tau-som'],
    },
    {
      slug: 'thu-gui-mua-thu',
      name: 'Thư Gửi Mùa Thu',
      description: 'Phòng đặc biệt, lên sóng tối thứ Bảy.',
      status: LiveRoomStatus.SCHEDULED,
      playlist: [],
    },
  ];
  for (const room of rooms) {
    const playlistTitle = `Phòng: ${room.name}`;
    const existing = await prisma.playlist.findFirst({
      where: { title: playlistTitle, ownerId: hostId },
      select: { id: true },
    });
    const playlist =
      existing ??
      (await prisma.playlist.create({
        data: { title: playlistTitle, ownerId: hostId, isPublic: false },
        select: { id: true },
      }));
    await prisma.playlistItem.deleteMany({
      where: { playlistId: playlist.id },
    });
    await prisma.playlistItem.createMany({
      data: room.playlist
        .filter((slug) => postIds[slug])
        .map((slug, position) => ({
          playlistId: playlist.id,
          postId: postIds[slug],
          position,
        })),
    });
    const data = {
      name: room.name,
      description: room.description,
      status: room.status,
      scheduledAt:
        room.status === LiveRoomStatus.SCHEDULED
          ? new Date(Date.now() + 3 * 86_400_000)
          : null,
      playlist: { connect: { id: playlist.id } },
    };
    await prisma.liveRoom.upsert({
      where: { slug: room.slug },
      update: data,
      create: { ...data, slug: room.slug, host: { connect: { id: hostId } } },
    });
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
