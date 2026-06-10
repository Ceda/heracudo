const nock = require('nock');

const mockGetCfZoneIds = jest.fn();
jest.mock('../lib/helpers/getCfZoneIds', () => () => mockGetCfZoneIds());

const postDeploy = require('../lib/postDeploy');

const mockGithub = (patchMatcher = () => true) => {
  nock('https://api.github.com')
    .get('/repos/user/repo/pulls/456')
    .reply(200, { body: 'Existing PR body' })
    .patch('/repos/user/repo/pulls/456', patchMatcher)
    .reply(200, { body: 'Updated PR body' });
};

const mockJira = () => {
  nock('https://test.atlassian.net')
    .get('/rest/api/3/search/jql')
    .query(true)
    .reply(200, { issues: [{ key: 'TEST-123' }] })
    .get('/rest/api/3/field')
    .reply(200, [{ id: 'customfield_10001', name: 'ReviewApps' }])
    .put('/rest/api/3/issue/TEST-123')
    .reply(204);
};

describe('postDeploy', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();

    process.env.HRCD_HOSTNAME = 'example.com';
    process.env.HEROKU_APP_NAME = 'test-pr-123';

    mockGetCfZoneIds.mockReturnValue([
      { domain: 'example.com', zoneId: 'test-zone-id' },
    ]);
  });

  afterAll(() => {
    nock.cleanAll();
  });

  test('should create domain, DNS record, PR link and Jira comment', async () => {
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, {
        hostname: 'test-pr-123.example.com',
        cname: 'test-pr-123.herokudns.com',
      });

    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records', {
        name: 'test-pr-123',
        content: 'test-pr-123.herokudns.com',
        type: 'CNAME',
        proxied: true,
      })
      .reply(200, { success: true, result: { id: 'dns-1' } });

    mockGithub(({ body }) => body.includes('https://test-pr-123.example.com'));
    mockJira();

    await postDeploy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should continue with remaining hostnames when one fails', async () => {
    process.env.HRCD_HOSTNAME = 'example.com,example.org';
    mockGetCfZoneIds.mockReturnValue([
      { domain: 'example.com', zoneId: 'zone-broken' },
      { domain: 'example.org', zoneId: 'zone-ok' },
    ]);

    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .times(2)
      .reply(201, (uri, requestBody) => ({
        hostname: requestBody.hostname,
        cname: 'test-pr-123.herokudns.com',
      }));

    // First zone is gone (same as an expired/deleted Cloudflare zone)
    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/zone-broken/dns_records')
      .reply(400, { success: false, errors: [{ code: 7003, message: 'Could not route to /zones/zone-broken' }] })
      .post('/client/v4/zones/zone-ok/dns_records')
      .reply(200, { success: true, result: { id: 'dns-2' } });

    mockGithub(({ body }) => body.includes('https://test-pr-123.example.org')
      && !body.includes('https://test-pr-123.example.com'));
    mockJira();

    await postDeploy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should treat already existing DNS record as success', async () => {
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, {
        hostname: 'test-pr-123.example.com',
        cname: 'test-pr-123.herokudns.com',
      });

    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(400, { success: false, errors: [{ code: 81057, message: 'Record already exists.' }] })
      .get('/client/v4/zones/test-zone-id/dns_records')
      .query({ name: 'test-pr-123.example.com' })
      .reply(200, {
        success: true,
        result: [{
          id: 'dns-1',
          type: 'CNAME',
          name: 'test-pr-123.example.com',
          content: 'test-pr-123.herokudns.com',
        }],
      });

    mockGithub(({ body }) => body.includes('https://test-pr-123.example.com'));
    mockJira();

    await postDeploy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should update existing DNS record pointing to a stale cname', async () => {
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, {
        hostname: 'test-pr-123.example.com',
        cname: 'test-pr-123-new.herokudns.com',
      });

    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(400, { success: false, errors: [{ code: 81057, message: 'Record already exists.' }] })
      .get('/client/v4/zones/test-zone-id/dns_records')
      .query({ name: 'test-pr-123.example.com' })
      .reply(200, {
        success: true,
        result: [{
          id: 'dns-stale',
          type: 'CNAME',
          name: 'test-pr-123.example.com',
          content: 'test-pr-123-old.herokudns.com',
        }],
      })
      .put('/client/v4/zones/test-zone-id/dns_records/dns-stale', {
        name: 'test-pr-123.example.com',
        content: 'test-pr-123-new.herokudns.com',
        type: 'CNAME',
        proxied: true,
      })
      .reply(200, { success: true });

    mockGithub(({ body }) => body.includes('https://test-pr-123.example.com'));
    mockJira();

    await postDeploy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should reuse already existing Heroku domain', async () => {
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(422, { id: 'invalid_params', message: 'Hostname is already added to this app.' })
      .get('/apps/test-pr-123/domains/test-pr-123.example.com')
      .reply(200, {
        hostname: 'test-pr-123.example.com',
        cname: 'test-pr-123.herokudns.com',
      });

    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, { success: true, result: { id: 'dns-1' } });

    mockGithub();
    mockJira();

    await postDeploy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should skip hostname without configured zone and continue', async () => {
    process.env.HRCD_HOSTNAME = 'unknown.com,example.com';

    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains', { hostname: 'test-pr-123.example.com', sni_endpoint: null })
      .reply(201, {
        hostname: 'test-pr-123.example.com',
        cname: 'test-pr-123.herokudns.com',
      });

    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, { success: true, result: { id: 'dns-1' } });

    mockGithub(({ body }) => !body.includes('unknown.com'));
    mockJira();

    await postDeploy();

    expect(nock.isDone()).toBe(true);
    expect(process.exit).not.toHaveBeenCalled();
  });

  test('should exit 1 when all hostnames fail', async () => {
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(500, { message: 'Internal server error' });

    await postDeploy();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should not exit when only Github and Jira updates fail', async () => {
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, {
        hostname: 'test-pr-123.example.com',
        cname: 'test-pr-123.herokudns.com',
      });

    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, { success: true, result: { id: 'dns-1' } });

    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(500, { message: 'Internal server error' });

    nock('https://test.atlassian.net')
      .get('/rest/api/3/search/jql')
      .query(true)
      .reply(500, { message: 'Internal server error' });

    await postDeploy();

    expect(process.exit).not.toHaveBeenCalled();
  });
});
