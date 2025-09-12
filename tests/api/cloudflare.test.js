const nock = require('nock');
const cloudflare = require('../../lib/api/cloudflare');

describe('cloudflare API', () => {
  const CLOUDFLARE_BASE_URL = 'https://api.cloudflare.com';
  const TEST_ZONE_ID = 'test-zone-id';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('getDnsRecords', () => {
    test('should get DNS records for zone', async () => {
      const mockResponse = {
        success: true,
        result: [
          {
            id: 'record1', name: 'test.example.com', type: 'CNAME', content: 'target.heroku.com',
          },
        ],
      };

      nock(CLOUDFLARE_BASE_URL)
        .get(`/client/v4/zones/${TEST_ZONE_ID}/dns_records/?per_page=100`)
        .reply(200, mockResponse);

      const response = await cloudflare.getDnsRecords(TEST_ZONE_ID);

      expect(response.data).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      nock(CLOUDFLARE_BASE_URL)
        .get(`/client/v4/zones/${TEST_ZONE_ID}/dns_records/?per_page=100`)
        .reply(500, { message: 'Server error' });

      await expect(cloudflare.getDnsRecords(TEST_ZONE_ID)).rejects.toThrow();
    });

    test('should get specific DNS record by ID', async () => {
      const recordId = 'record123';
      const mockResponse = {
        success: true,
        result: { id: recordId, name: 'test.example.com' },
      };

      nock(CLOUDFLARE_BASE_URL)
        .get(`/client/v4/zones/${TEST_ZONE_ID}/dns_records/${recordId}?per_page=100`)
        .reply(200, mockResponse);

      const response = await cloudflare.getDnsRecords(TEST_ZONE_ID, recordId);

      expect(response.data).toEqual(mockResponse);
    });

    test('should throw error when zoneID is missing', async () => {
      await expect(async () => {
        await cloudflare.getDnsRecords();
      }).rejects.toThrow('"zoneID" required but not defined.');
    });
  });

  describe('createDnsRecord', () => {
    test('should create CNAME record', async () => {
      const mockResponse = {
        success: true,
        result: {
          id: 'new-record-id',
          name: 'pr123.example.com',
          content: 'target.herokuapp.com',
          type: 'CNAME',
          proxied: true,
        },
      };

      nock(CLOUDFLARE_BASE_URL)
        .post(`/client/v4/zones/${TEST_ZONE_ID}/dns_records`, {
          name: 'pr123.example.com',
          content: 'target.herokuapp.com',
          type: 'CNAME',
          proxied: true,
        })
        .reply(200, mockResponse);

      const response = await cloudflare.createDnsRecord(
        TEST_ZONE_ID,
        'pr123.example.com',
        'target.herokuapp.com',
      );

      expect(response.data).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      nock(CLOUDFLARE_BASE_URL)
        .post(`/client/v4/zones/${TEST_ZONE_ID}/dns_records`)
        .reply(400, { message: 'Bad request' });

      await expect(cloudflare.createDnsRecord(
        TEST_ZONE_ID,
        'test.example.com',
        'target.herokuapp.com',
      )).rejects.toThrow();
    });

    test('should throw error when required parameters are missing', async () => {
      await expect(async () => {
        await cloudflare.createDnsRecord();
      }).rejects.toThrow('"zoneID" required but not defined.');

      await expect(async () => {
        await cloudflare.createDnsRecord(TEST_ZONE_ID);
      }).rejects.toThrow('"name" required but not defined.');

      await expect(async () => {
        await cloudflare.createDnsRecord(TEST_ZONE_ID, 'test');
      }).rejects.toThrow('"content" required but not defined.');
    });
  });

  describe('deleteDnsRecord', () => {
    test('should delete DNS record', async () => {
      const recordId = 'record-to-delete';
      const mockResponse = {
        success: true,
        result: { id: recordId },
      };

      nock(CLOUDFLARE_BASE_URL)
        .delete(`/client/v4/zones/${TEST_ZONE_ID}/dns_records/${recordId}`)
        .reply(200, mockResponse);

      const response = await cloudflare.deleteDnsRecord(TEST_ZONE_ID, recordId);

      expect(response.data).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      const recordId = 'record-to-delete';

      nock(CLOUDFLARE_BASE_URL)
        .delete(`/client/v4/zones/${TEST_ZONE_ID}/dns_records/${recordId}`)
        .reply(404, { message: 'Record not found' });

      await expect(cloudflare.deleteDnsRecord(TEST_ZONE_ID, recordId)).rejects.toThrow();
    });

    test('should throw error when required parameters are missing', async () => {
      await expect(async () => {
        await cloudflare.deleteDnsRecord();
      }).rejects.toThrow('"zoneID" required but not defined.');

      await expect(async () => {
        await cloudflare.deleteDnsRecord(TEST_ZONE_ID);
      }).rejects.toThrow('"id" required but not defined.');
    });
  });
});
