const nock = require('nock');

const mockGetCfZoneIds = jest.fn();
jest.mock('../lib/helpers/getCfZoneIds', () => () => mockGetCfZoneIds());

const preDestroy = require('../lib/preDestroy');

const mockGithub = () => {
  nock('https://api.github.com')
    .get('/repos/user/repo/pulls/456')
    .reply(200, { body: 'PR content' })
    .patch('/repos/user/repo/pulls/456')
    .reply(200, { body: 'PR content' });
};

describe('preDestroy', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();

    process.env.HEROKU_APP_NAME = 'test-pr-123';

    mockGetCfZoneIds.mockReturnValue([
      { domain: 'example.com', zoneId: 'test-zone-id' },
    ]);
  });

  afterAll(() => {
    nock.cleanAll();
  });

  test('should delete DNS records and domains for all matching domains', async () => {
    mockGetCfZoneIds.mockReturnValue([
      { domain: 'example.com', zoneId: 'zone-1' },
      { domain: 'example.org', zoneId: 'zone-2' },
    ]);

    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, [
        { hostname: 'test-pr-123.example.com', cname: 'cname-1.herokudns.com' },
        { hostname: 'test-pr-123.example.org', cname: 'cname-2.herokudns.com' },
      ]);

    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/zone-1/dns_records/?per_page=100')
      .reply(200, { success: true, result: [{ id: 'dns-1', content: 'cname-1.herokudns.com' }] })
      .get('/client/v4/zones/zone-2/dns_records/?per_page=100')
      .reply(200, { success: true, result: [{ id: 'dns-2', content: 'cname-2.herokudns.com' }] })
      .delete('/client/v4/zones/zone-1/dns_records/dns-1')
      .reply(200, { success: true })
      .delete('/client/v4/zones/zone-2/dns_records/dns-2')
      .reply(200, { success: true });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.example.com')
      .reply(200, {})
      .delete('/apps/test-pr-123/domains/test-pr-123.example.org')
      .reply(200, {});

    mockGithub();

    await preDestroy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should continue with remaining domains when one cleanup fails', async () => {
    mockGetCfZoneIds.mockReturnValue([
      { domain: 'example.com', zoneId: 'zone-broken' },
      { domain: 'example.org', zoneId: 'zone-ok' },
    ]);

    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, [
        { hostname: 'test-pr-123.example.com', cname: 'cname-1.herokudns.com' },
        { hostname: 'test-pr-123.example.org', cname: 'cname-2.herokudns.com' },
      ]);

    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/zone-broken/dns_records/?per_page=100')
      .reply(400, { success: false, errors: [{ code: 7003, message: 'Could not route to /zones/zone-broken' }] })
      .get('/client/v4/zones/zone-ok/dns_records/?per_page=100')
      .reply(200, { success: true, result: [{ id: 'dns-2', content: 'cname-2.herokudns.com' }] })
      .delete('/client/v4/zones/zone-ok/dns_records/dns-2')
      .reply(200, { success: true });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.example.org')
      .reply(200, {});

    mockGithub();

    await preDestroy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should skip domains without matching zone', async () => {
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, [
        { hostname: 'test-pr-123.herokuapp.com', cname: null },
      ]);

    mockGithub();

    await preDestroy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should delete Heroku domain even when DNS record is missing', async () => {
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, [
        { hostname: 'test-pr-123.example.com', cname: 'cname-1.herokudns.com' },
      ]);

    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/test-zone-id/dns_records/?per_page=100')
      .reply(200, { success: true, result: [] });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.example.com')
      .reply(200, {});

    mockGithub();

    await preDestroy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should not exit when Github update fails', async () => {
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, []);

    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(500, { message: 'Internal server error' });

    await preDestroy();

    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should exit 1 when domains cannot be listed', async () => {
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(500, { message: 'Internal server error' });

    await preDestroy();

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
