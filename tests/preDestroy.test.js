const nock = require('nock');

// Mock modules before requiring preDestroy
jest.mock('../lib/helpers/getCfZoneIds', () => () => [
  { domain: 'test.example.com', zoneId: 'test-zone-id' },
]);

const preDestroy = require('../lib/preDestroy');

describe('preDestroy', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();

    process.env.HEROKU_APP_NAME = 'test-pr-123';
  });

  afterAll(() => {
    nock.cleanAll();
  });

  test('should delete domains and DNS records', async () => {
    const mockDomains = [
      {
        hostname: 'test-pr-123.test.example.com',
        cname: 'test-pr-123.herokuapp.com',
      },
    ];

    const mockDnsRecords = [
      {
        id: 'dns-record-123',
        content: 'test-pr-123.herokuapp.com',
        name: 'test-pr-123.test.example.com',
      },
    ];

    // Mock Heroku get domains - note: should return domains in 'data' field
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, { data: mockDomains });

    // Mock Cloudflare get DNS records
    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/test-zone-id/dns_records/?per_page=100')
      .reply(200, { data: { result: mockDnsRecords } });

    // Mock delete operations
    nock('https://api.cloudflare.com')
      .delete('/client/v4/zones/test-zone-id/dns_records/dns-record-123')
      .reply(200, { success: true });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.test.example.com')
      .reply(200, { deleted: true });

    // Mock GitHub delete PR link
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, {
        body: '## Review App: [https://test.example.com](https://test.example.com) 🚀\r\nOther content',
      })
      .patch('/repos/user/repo/pulls/456', {
        body: 'Other content',
      })
      .reply(200, { body: 'Other content' });

    await preDestroy();
  });

  test('should handle complex domain parsing in reduce function', async () => {
    const mockDomains = [
      {
        hostname: 'test-pr-123.test.example.com',
        cname: 'test-pr-123.herokuapp.com',
      },
      {
        hostname: 'test-pr-456.staging.example.org',
        cname: 'test-pr-456.herokuapp.com',
      },
    ];

    const mockDnsRecords = [
      {
        id: 'dns-record-123',
        content: 'test-pr-123.herokuapp.com',
      },
      {
        id: 'dns-record-456',
        content: 'test-pr-456.herokuapp.com',
      },
    ];

    // Update mock to return multiple zones
    jest.doMock('../lib/helpers/getCfZoneIds', () => () => [
      { domain: 'test.example.com', zoneId: 'zone-1' },
      { domain: 'staging.example.org', zoneId: 'zone-2' },
    ]);

    // Mock Heroku get domains
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, { data: mockDomains });

    // Mock Cloudflare for first domain
    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/zone-1/dns_records/?per_page=100')
      .reply(200, { data: { result: [mockDnsRecords[0]] } });

    // Mock Cloudflare for second domain
    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/zone-2/dns_records/?per_page=100')
      .reply(200, { data: { result: [mockDnsRecords[1]] } });

    // Mock delete operations
    nock('https://api.cloudflare.com')
      .delete('/client/v4/zones/zone-1/dns_records/dns-record-123')
      .reply(200, { success: true })
      .delete('/client/v4/zones/zone-2/dns_records/dns-record-456')
      .reply(200, { success: true });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.test.example.com')
      .reply(200, { deleted: true })
      .delete('/apps/test-pr-123/domains/test-pr-456.staging.example.org')
      .reply(200, { deleted: true });

    // Mock GitHub
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Content' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Content' });

    const preDestroyMultiple = require('../lib/preDestroy');
    await preDestroyMultiple();
  });

  test('should handle domains without matching DNS records', async () => {
    const mockDomains = [
      {
        hostname: 'test-pr-123.test.example.com',
        cname: 'test-pr-123.herokuapp.com',
      },
    ];

    // Mock Heroku get domains
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, { data: mockDomains });

    // Mock Cloudflare get DNS records (no matching records)
    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/test-zone-id/dns_records/?per_page=100')
      .reply(200, { data: { result: [] } });

    // Mock GitHub delete PR link
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Just PR content' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Just PR content' });

    // Should not make delete requests for DNS/domains
    await preDestroy();
  });

  test('should handle domains that trigger parseDomain and zone logic', async () => {
    const mockDomains = [
      {
        hostname: 'test-pr-123.subdomain.test.example.com', // Complex subdomain to trigger parseDomain logic
        cname: 'test-pr-123.herokuapp.com',
      },
    ];

    const mockDnsRecords = [
      {
        id: 'dns-record-123',
        content: 'test-pr-123.herokuapp.com',
      },
    ];

    // Mock getCfZoneIds to match the parsed domain
    jest.doMock('../lib/helpers/getCfZoneIds', () => () => [
      { domain: 'subdomain.test.example.com', zoneId: 'test-zone-id' },
    ]);

    // Mock Heroku get domains
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, { data: mockDomains });

    // Mock Cloudflare get DNS records
    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/test-zone-id/dns_records/?per_page=100')
      .reply(200, { data: { result: mockDnsRecords } });

    // Mock delete operations
    nock('https://api.cloudflare.com')
      .delete('/client/v4/zones/test-zone-id/dns_records/dns-record-123')
      .reply(200, { success: true });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.subdomain.test.example.com')
      .reply(200, { deleted: true });

    // Mock GitHub
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Content' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Content' });

    const preDestroyComplex = require('../lib/preDestroy');
    await preDestroyComplex();
  });

  test('should handle domains without matching zone', async () => {
    const mockDomains = [
      {
        hostname: 'unmatched-domain.other.com',
        cname: 'test-pr-123.herokuapp.com',
      },
    ];

    // Mock Heroku get domains
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, { data: mockDomains });

    // Mock GitHub delete PR link
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Just PR content' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Just PR content' });

    // Should not make Cloudflare requests
    await preDestroy();
  });

  test('should handle multiple domains', async () => {
    const mockDomains = [
      {
        hostname: 'test-pr-123.test.example.com',
        cname: 'test-pr-123.herokuapp.com',
      },
      {
        hostname: 'test-pr-123-api.test.example.com',
        cname: 'test-pr-123.herokuapp.com',
      },
    ];

    const mockDnsRecords = [
      {
        id: 'dns-1',
        content: 'test-pr-123.herokuapp.com',
        name: 'test-pr-123.test.example.com',
      },
      {
        id: 'dns-2',
        content: 'test-pr-123.herokuapp.com',
        name: 'test-pr-123-api.test.example.com',
      },
    ];

    // Mock Heroku get domains
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(200, { data: mockDomains });

    // Mock Cloudflare get DNS records (called once per domain with matching zone)
    nock('https://api.cloudflare.com')
      .get('/client/v4/zones/test-zone-id/dns_records/?per_page=100')
      .times(2)
      .reply(200, { data: { result: mockDnsRecords } });

    // Mock delete operations
    nock('https://api.cloudflare.com')
      .delete('/client/v4/zones/test-zone-id/dns_records/dns-1')
      .reply(200, { success: true })
      .delete('/client/v4/zones/test-zone-id/dns_records/dns-2')
      .reply(200, { success: true });

    nock('https://api.heroku.com')
      .delete('/apps/test-pr-123/domains/test-pr-123.test.example.com')
      .reply(200, { deleted: true })
      .delete('/apps/test-pr-123/domains/test-pr-123-api.test.example.com')
      .reply(200, { deleted: true });

    // Mock GitHub delete PR link
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Just PR content' })
      .patch('/repos/user/repo/pulls/456')
      .reply(200, { body: 'Just PR content' });

    await preDestroy();
  });

  test('should handle API errors gracefully', async () => {
    // Mock Heroku error
    nock('https://api.heroku.com')
      .get('/apps/test-pr-123/domains/')
      .reply(500, { message: 'Internal server error' });

    await preDestroy();

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
