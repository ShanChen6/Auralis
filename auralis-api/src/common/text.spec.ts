import {
  countWords,
  estimateTimestamps,
  slugify,
  splitParagraphs,
} from './text.js';

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, chữ đ và ký tự đặc biệt', () => {
    expect(slugify('Trạm đêm mưa – Số 1!')).toBe('tram-dem-mua-so-1');
    expect(slugify('  Ổn thôi, rồi sẽ ổn  ')).toBe('on-thoi-roi-se-on');
    expect(slugify('ĐƯỜNG XA')).toBe('duong-xa');
    expect(slugify('!!!')).toBe('');
  });

  it('cắt độ dài và không để gạch ngang cuối', () => {
    expect(slugify('a '.repeat(100), 10)).toBe('a-a-a-a-a');
  });
});

describe('estimateTimestamps', () => {
  it('chia thời lượng theo tỉ lệ độ dài đoạn, liền mạch tới hết bài', () => {
    const stamps = estimateTimestamps(['a'.repeat(10), 'b'.repeat(30)], 40);
    expect(stamps).toEqual([
      { index: 0, start: 0, end: 10 },
      { index: 1, start: 10, end: 40 },
    ]);
  });

  it('tách đoạn và đếm từ', () => {
    expect(splitParagraphs('Một.\n\n\nHai.')).toEqual(['Một.', 'Hai.']);
    expect(countWords(' Xin  chào\nbạn ')).toBe(3);
  });
});
