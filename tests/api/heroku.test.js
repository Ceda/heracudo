const nock = require('nock');
const heroku = require('../../lib/api/heroku');

describe('heroku API', () => {
  const HEROKU_BASE_URL = 'https://api.heroku.com';
  const TEST_APP_NAME = 'test-app-123';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('getAppName', () => {
    test('should return app name from environment', () => {
      const appName = heroku.getAppName();
      expect(appName).toBe(TEST_APP_NAME);
    });
  });

  describe('getDomains', () => {
    test('should get all domains for app', async () => {
      const mockResponse = [
        { hostname: 'pr123.example.com', cname: 'target.herokuapp.com' },
        { hostname: 'pr124.example.com', cname: 'target2.herokuapp.com' },
      ];

      nock(HEROKU_BASE_URL)
        .get(`/apps/${TEST_APP_NAME}/domains/`)
        .reply(200, mockResponse);

      const response = await heroku.getDomains();

      expect(response.data).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      nock(HEROKU_BASE_URL)
        .get(`/apps/${TEST_APP_NAME}/domains/`)
        .reply(401, { message: 'Unauthorized' });

      await expect(heroku.getDomains()).rejects.toThrow();
    });

    test('should get specific domain', async () => {
      const hostname = 'pr123.example.com';
      const mockResponse = { hostname, cname: 'target.herokuapp.com' };

      nock(HEROKU_BASE_URL)
        .get(`/apps/${TEST_APP_NAME}/domains/${hostname}`)
        .reply(200, mockResponse);

      const response = await heroku.getDomains(hostname);

      expect(response.data).toEqual(mockResponse);
    });
  });

  describe('createDomain', () => {
    test('should create domain for app', async () => {
      const hostname = 'pr125.example.com';
      const mockResponse = {
        hostname,
        cname: 'new-target.herokuapp.com',
        status: 'pending',
      };

      nock(HEROKU_BASE_URL)
        .post(`/apps/${TEST_APP_NAME}/domains`, {
          hostname,
          sni_endpoint: null,
        })
        .reply(201, mockResponse);

      const response = await heroku.createDomain(hostname);

      expect(response.data).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      const hostname = 'test.example.com';

      nock(HEROKU_BASE_URL)
        .post(`/apps/${TEST_APP_NAME}/domains`)
        .reply(422, { message: 'Domain already exists' });

      await expect(heroku.createDomain(hostname)).rejects.toThrow();
    });

    test('should throw error when hostname is missing', async () => {
      await expect(async () => {
        await heroku.createDomain();
      }).rejects.toThrow('"hostname" required but not defined.');
    });
  });

  describe('deleteDomain', () => {
    test('should delete domain from app', async () => {
      const hostname = 'pr123.example.com';
      const mockResponse = { hostname, deleted: true };

      nock(HEROKU_BASE_URL)
        .delete(`/apps/${TEST_APP_NAME}/domains/${hostname}`)
        .reply(200, mockResponse);

      const response = await heroku.deleteDomain(hostname);

      expect(response.data).toEqual(mockResponse);
    });

    test('should handle API errors', async () => {
      const hostname = 'test.example.com';

      nock(HEROKU_BASE_URL)
        .delete(`/apps/${TEST_APP_NAME}/domains/${hostname}`)
        .reply(404, { message: 'Domain not found' });

      await expect(heroku.deleteDomain(hostname)).rejects.toThrow();
    });

    test('should throw error when hostname is missing', async () => {
      await expect(async () => {
        await heroku.deleteDomain();
      }).rejects.toThrow('"hostname" required but not defined.');
    });
  });
});
