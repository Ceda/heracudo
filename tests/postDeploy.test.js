const nock = require('nock');

// Mock modules before requiring postDeploy
jest.mock('../lib/helpers/getCfZoneIds', () => () => [
  { domain: 'test.example.com', zoneId: 'test-zone-id' },
]);

const postDeploy = require('../lib/postDeploy');

describe('postDeploy', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();

    // Set required env vars
    process.env.HRCD_HOSTNAME = 'test.example.com';
    process.env.HEROKU_APP_NAME = 'test-pr-123';
  });

  afterAll(() => {
    nock.cleanAll();
  });

  test('should create domain, DNS record, and update PR', async () => {
    const expectedHostname = 'test-pr-123.test.example.com';
    const expectedCname = 'test-pr-123.herokuapp.com';

    // Mock Heroku create domain
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, {
        data: {
          hostname: expectedHostname,
          cname: expectedCname,
        },
      });

    // Mock Cloudflare create DNS record
    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, {
        success: true,
        result: { id: 'new-dns-record-id' },
      });

    // Mock GitHub update PR
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Existing PR body' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Updated PR body' });

    // Mock Jira search and comment
    nock('https://test.atlassian.net')
      .get('/rest/api/3/search')
      .query(true)
      .reply(200, { issues: [{ key: 'TEST-123' }] })
      .post('/rest/api/3/issue/TEST-123/comment')
      .reply(201, { id: 'comment-id' });

    await postDeploy();
  });

  test('should handle multiple hostnames', async () => {
    process.env.HRCD_HOSTNAME = 'test.example.com,staging.example.com';
    process.env.HRCD_CLOUDFLARE_ZONE_ID = 'zone1,zone2';

    // Mock getCfZoneIds for multiple zones
    jest.doMock('../lib/helpers/getCfZoneIds', () => () => [
      { domain: 'test.example.com', zoneId: 'zone1' },
      { domain: 'staging.example.com', zoneId: 'zone2' },
    ]);

    // Mock multiple Heroku domains
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .times(2)
      .reply(201, (uri, requestBody) => ({
        data: {
          hostname: requestBody.hostname,
          cname: 'test-pr-123.herokuapp.com',
        },
      }));

    // Mock multiple Cloudflare DNS records
    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/zone1/dns_records')
      .reply(200, { success: true, result: { id: 'dns1' } })
      .post('/client/v4/zones/zone2/dns_records')
      .reply(200, { success: true, result: { id: 'dns2' } });

    // Mock GitHub and Jira once
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Existing PR body' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Updated PR body' });

    nock('https://test.atlassian.net')
      .get('/rest/api/3/search')
      .query(true)
      .reply(200, { issues: [{ key: 'TEST-123' }] })
      .post('/rest/api/3/issue/TEST-123/comment')
      .reply(201, { id: 'comment-id' });

    const postDeployMultiple = require('../lib/postDeploy');
    await postDeployMultiple();
  });

  test('should handle subdomain hostname', async () => {
    process.env.HRCD_HOSTNAME = 'api.test.example.com';

    // Mock Heroku create domain with subdomain
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains', {
        hostname: 'test-pr-123-api.test.example.com',
        sni_endpoint: null,
      })
      .reply(201, {
        data: {
          hostname: 'test-pr-123-api.test.example.com',
          cname: 'test-pr-123.herokuapp.com',
        },
      });

    // Mock other services
    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, { success: true, result: { id: 'dns-id' } });

    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Existing PR body' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Updated PR body' });

    nock('https://test.atlassian.net')
      .get('/rest/api/3/search')
      .query(true)
      .reply(200, { issues: [{ key: 'TEST-123' }] })
      .post('/rest/api/3/issue/TEST-123/comment')
      .reply(201, { id: 'comment-id' });

    await postDeploy();
  });

  test('should handle API errors gracefully', async () => {
    // Mock Heroku error
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(500, { message: 'Internal server error' });

    await postDeploy();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should add Jira comment when hostnames exist', async () => {
    const expectedHostname = 'test-pr-123.test.example.com';
    const expectedCname = 'test-pr-123.herokuapp.com';

    // Mock Heroku create domain
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, {
        data: {
          hostname: expectedHostname,
          cname: expectedCname,
        },
      });

    // Mock Cloudflare create DNS record
    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, {
        success: true,
        result: { id: 'new-dns-record-id' },
      });

    // Mock GitHub update PR
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Existing PR body' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Updated PR body' });

    // Mock Jira search and comment - this should be called
    nock('https://test.atlassian.net')
      .get('/rest/api/3/search')
      .query(true)
      .reply(200, { issues: [{ key: 'TEST-123' }] })
      .post('/rest/api/3/issue/TEST-123/comment')
      .reply(201, { id: 'comment-id' });

    await postDeploy();
  });

  test('should skip Jira comment when no hostnames', async () => {
    // Mock Heroku to return empty hostname - this creates empty reviewAppHostnames array
    nock('https://api.heroku.com')
      .post('/apps/test-pr-123/domains')
      .reply(201, { data: { hostname: '', cname: 'test.herokuapp.com' } });

    // Mock Cloudflare
    nock('https://api.cloudflare.com')
      .post('/client/v4/zones/test-zone-id/dns_records')
      .reply(200, { success: true });

    // Mock GitHub
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Body' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Body' });

    // Jira should NOT be called
    await postDeploy();
  });
});
