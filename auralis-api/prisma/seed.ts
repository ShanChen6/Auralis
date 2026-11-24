import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AudioSource,
  AudioStatus,
  MoodTag,
  PostStatus,
  PrismaClient,
  UserRole,
} from '../src/generated/prisma/client.js';

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

const posts = [
  {
    title: 'Trạm đêm mưa',
    slug: 'tram-dem-mua',
    summary:
      'Những giọt mưa gõ nhịp trên mái tôn, và một người ngồi nghe lòng mình lặng lại.',
    moodTag: MoodTag.CALM,
    category: 'radio-dem',
    voiceName: 'vi-VN-HoaiMyNeural',
    backgroundMusic: 'piano_rain',
  },
  {
    title: 'Gửi người đã từng thương',
    slug: 'gui-nguoi-da-tung-thuong',
    summary:
      'Có những lá thư không cần gửi đi, chỉ cần viết xong là lòng nhẹ bớt.',
    moodTag: MoodTag.NOSTALGIC,
    category: 'thu-gui',
    voiceName: 'vi-VN-NamMinhNeural',
    backgroundMusic: 'acoustic_night',
  },
  {
    title: 'Ổn thôi, rồi sẽ ổn',
    slug: 'on-thoi-roi-se-on',
    summary: 'Một lời nhắc nhỏ cho những ngày mọi thứ dường như quá sức.',
    moodTag: MoodTag.HEALING,
    category: 'chua-lanh',
    voiceName: 'vi-VN-HoaiMyNeural',
    backgroundMusic: 'lofi_warm',
  },
  {
    title: 'Mùa hoa sữa cuối phố',
    slug: 'mua-hoa-sua-cuoi-pho',
    summary: 'Hà Nội tháng mười, mùi hoa sữa và một con phố cũ đầy kỷ niệm.',
    moodTag: MoodTag.ROMANTIC,
    category: 'tan-van',
    voiceName: 'vi-VN-NamMinhNeural',
    backgroundMusic: 'piano_rain',
  },
  {
    title: 'Chuyến tàu sớm',
    slug: 'chuyen-tau-som',
    summary: 'Câu chuyện về một chuyến đi bắt đầu từ lúc trời còn chưa sáng.',
    moodTag: MoodTag.HOPEFUL,
    category: 'truyen-ngan',
    voiceName: 'vi-VN-HoaiMyNeural',
    backgroundMusic: 'acoustic_night',
  },
];

async function main(): Promise<void> {
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
    const { category: categorySlug, ...data } = post;
    const paragraphs = [
      data.summary,
      'Đây là nội dung mẫu cho môi trường phát triển. Mỗi đoạn văn tương ứng với một mốc thời gian để trình phát bôi sáng khi đọc.',
      'Hãy thay nội dung này bằng tản văn thật khi Creator Studio hoàn thiện.',
    ];

    await prisma.post.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        status: PostStatus.PUBLISHED,
        audioSource: AudioSource.NONE,
        audioStatus: AudioStatus.TEXT_ONLY,
        isFeatured: true,
        publishedAt: new Date(now - index * 86_400_000),
        author: { connect: { id: author.id } },
        category: { connect: { slug: categorySlug } },
        content: {
          create: {
            content: paragraphs.join('\n\n'),
            wordCount: paragraphs.join(' ').split(/\s+/).length,
          },
        },
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
