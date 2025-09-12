const nock = require('nock');
const markReady = require('../lib/markReady');

describe('markReady', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  test('should mark PR link as ready when env vars are set', async () => {
    process.env.HEROKU_APP_NAME = 'test-app';
    process.env.HEROKU_PR_NUMBER = '123';

    const originalBody = '## Review App: [https://test.example.com](https://test.example.com) ⏳\r\nContent';
    const expectedBody = '## Review App: [https://test.example.com](https://test.example.com) 🚀\r\nContent';

    // Mock GitHub PR operations
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/123')
      .reply(200, { body: originalBody })
      .patch('/repos/user/repo/pulls/123', { body: expectedBody })
      .reply(200, { body: expectedBody });

    await markReady();
  });

  test('should do nothing when HEROKU_APP_NAME is not set', async () => {
    delete process.env.HEROKU_APP_NAME;
    process.env.HEROKU_PR_NUMBER = '123';

    // Should not make any HTTP requests
    await markReady();
  });

  test('should do nothing when HEROKU_PR_NUMBER is not set', async () => {
    process.env.HEROKU_APP_NAME = 'test-app';
    delete process.env.HEROKU_PR_NUMBER;

    // Should not make any HTTP requests
    await markReady();
  });

  test('should do nothing when both env vars are missing', async () => {
    delete process.env.HEROKU_APP_NAME;
    delete process.env.HEROKU_PR_NUMBER;

    // Should not make any HTTP requests
    await markReady();
  });

  test('should handle GitHub API errors gracefully', async () => {
    process.env.HEROKU_APP_NAME = 'test-app';
    process.env.HEROKU_PR_NUMBER = '123';

    // Mock GitHub error
    nock('https://api.github.com')
      .get('/repos/user/repo/pulls/123')
      .reply(500, { message: 'Internal server error' });

    await markReady();

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
