import { loadStorageConfig, r2Endpoint } from './storage.config.js';

const fullEnv = {
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'auralis-media',
  R2_PUBLIC_URL: 'https://cdn.auralis.vn/',
};

describe('loadStorageConfig', () => {
  it('trả về null nếu thiếu bất kỳ biến R2_* bắt buộc nào', () => {
    expect(loadStorageConfig({})).toBeNull();
    expect(loadStorageConfig({ ...fullEnv, R2_BUCKET: '' })).toBeNull();
  });

  it('đọc cấu hình, bỏ "/" cuối của public URL và mặc định hạn 600 giây', () => {
    expect(loadStorageConfig(fullEnv)).toEqual({
      accountId: 'acc',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'auralis-media',
      publicUrl: 'https://cdn.auralis.vn',
      presignExpiresIn: 600,
    });
    expect(
      loadStorageConfig({ ...fullEnv, R2_PRESIGN_EXPIRES_IN: '120' })
        ?.presignExpiresIn,
    ).toBe(120);
  });

  it('dựng endpoint R2 theo account ID', () => {
    expect(r2Endpoint('acc')).toBe('https://acc.r2.cloudflarestorage.com');
  });
});
