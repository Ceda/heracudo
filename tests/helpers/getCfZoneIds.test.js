describe('getCfZoneIds helper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear cache for getCfZoneIds module
    delete require.cache[require.resolve('../../lib/helpers/getCfZoneIds')];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should return array of domain-zoneId pairs', () => {
    process.env.HRCD_HOSTNAME = 'domain1.com,domain2.com';
    process.env.HRCD_CLOUDFLARE_ZONE_ID = 'zone1,zone2';

    const getCfZoneIds = require('../../lib/helpers/getCfZoneIds');
    const result = getCfZoneIds();

    expect(result).toEqual([
      { domain: 'domain1.com', zoneId: 'zone1' },
      { domain: 'domain2.com', zoneId: 'zone2' },
    ]);
  });

  test('should handle single domain', () => {
    process.env.HRCD_HOSTNAME = 'single.com';
    process.env.HRCD_CLOUDFLARE_ZONE_ID = 'single-zone';

    const getCfZoneIds = require('../../lib/helpers/getCfZoneIds');
    const result = getCfZoneIds();

    expect(result).toEqual([
      { domain: 'single.com', zoneId: 'single-zone' },
    ]);
  });

  test('should throw error when lengths do not match', () => {
    process.env.HRCD_HOSTNAME = 'domain1.com,domain2.com';
    process.env.HRCD_CLOUDFLARE_ZONE_ID = 'zone1';

    const getCfZoneIds = require('../../lib/helpers/getCfZoneIds');
    expect(() => getCfZoneIds()).toThrow('CLOUDFLARE_ZONE_ID items length not match HOSTNAME length.');
  });

  test('should use fallback environment variables', () => {
    delete process.env.HRCD_HOSTNAME;
    delete process.env.HRCD_CLOUDFLARE_ZONE_ID;
    process.env.HOSTNAME = 'fallback.com';
    process.env.CLOUDFLARE_ZONE_ID = 'fallback-zone';

    const getCfZoneIds = require('../../lib/helpers/getCfZoneIds');
    const result = getCfZoneIds();

    expect(result).toEqual([
      { domain: 'fallback.com', zoneId: 'fallback-zone' },
    ]);
  });
});
