import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('băm bằng scrypt với salt ngẫu nhiên và xác minh đúng', async () => {
    const a = await hashPassword('mat-khau-dai');
    const b = await hashPassword('mat-khau-dai');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toBe(b);
    await expect(verifyPassword('mat-khau-dai', a)).resolves.toBe(true);
    await expect(verifyPassword('sai-mat-khau', a)).resolves.toBe(false);
  });

  it('từ chối chuỗi băm sai định dạng', async () => {
    await expect(verifyPassword('x', 'bcrypt$abc')).resolves.toBe(false);
    await expect(verifyPassword('x', '')).resolves.toBe(false);
  });
});
