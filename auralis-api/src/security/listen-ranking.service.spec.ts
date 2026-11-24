import { isoWeek } from './listen-ranking.service.js';

describe('isoWeek', () => {
  it('tính tuần ISO theo giờ Việt Nam', () => {
    expect(isoWeek(new Date('2026-11-24T05:00:00Z'))).toBe('2026-W48');
    // Chủ nhật 29/11 23:30 giờ VN vẫn thuộc tuần 48; 0h thứ Hai 30/11 sang tuần 49
    expect(isoWeek(new Date('2026-11-29T16:30:00Z'))).toBe('2026-W48');
    expect(isoWeek(new Date('2026-11-29T17:00:00Z'))).toBe('2026-W49');
    // Đầu năm thuộc tuần cuối của năm trước theo ISO
    expect(isoWeek(new Date('2027-01-01T05:00:00Z'))).toBe('2026-W53');
  });
});
