const nock = require('nock');
const github = require('../../lib/api/github');

describe('github API', () => {
  const GITHUB_BASE_URL = 'https://api.github.com';
  const TEST_REPO = 'user/repo';
  const TEST_PR_NUMBER = '456';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('createPrLinks', () => {
    test('should add review app links to PR description in single request', async () => {
      const hostnames = ['https://pr123.example.com', 'https://pr123.example.org'];
      const existingBody = 'Existing PR description';
      const expectedNewBody = [
        `## Review App: [${hostnames[0]}](${hostnames[0]}) 🚀`,
        `## Review App: [${hostnames[1]}](${hostnames[1]}) 🚀`,
        existingBody,
      ].join('\r\n');

      // Mock GET PR
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: existingBody });

      // Mock PATCH PR
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`, {
          body: expectedNewBody,
        })
        .reply(200, { body: expectedNewBody });

      const response = await github.createPrLinks(hostnames);

      expect(response.status).toBe(200);
    });

    test('should skip links already present in PR description', async () => {
      const hostname = 'https://pr123.example.com';
      const existingBody = `## Review App: [${hostname}](${hostname}) 🚀\r\nExisting PR description`;

      // Mock GET PR only — no PATCH expected
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: existingBody });

      const response = await github.createPrLinks([hostname]);

      expect(response).toBeNull();
      expect(nock.isDone()).toBe(true);
    });

    test('should handle PR with empty description', async () => {
      const hostname = 'https://pr123.example.com';
      const expectedNewBody = `## Review App: [${hostname}](${hostname}) 🚀\r\n`;

      // Mock GET PR with null body
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: null });

      // Mock PATCH PR
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`, {
          body: expectedNewBody,
        })
        .reply(200, { body: expectedNewBody });

      const response = await github.createPrLinks([hostname]);

      expect(response.status).toBe(200);
    });

    test('should handle API errors when updating PR', async () => {
      const hostname = 'https://pr123.example.com';

      // Mock GET PR success
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: 'Existing body' });

      // Mock PATCH PR error
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(403, { message: 'Forbidden' });

      await expect(github.createPrLinks([hostname])).rejects.toThrow();
    });

    test('should throw error when hostnames are missing', async () => {
      await expect(github.createPrLinks()).rejects.toThrow('"hostnames" required but not defined.');
    });
  });

  describe('deletePrLink', () => {
    test('should remove review app link from PR description', async () => {
      const originalBody = '## Review App: [https://pr123.example.com](https://pr123.example.com) 🚀\r\nOther content\r\n## Review App: [https://pr124.example.com](https://pr124.example.com) 🚀\r\nMore content';
      const expectedBody = 'Other content\r\nMore content';

      // Mock GET PR
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: originalBody });

      // Mock PATCH PR
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`, {
          body: expectedBody,
        })
        .reply(200, { body: expectedBody });

      const response = await github.deletePrLink();

      expect(response.status).toBe(200);
    });

    test('should handle API errors when updating PR', async () => {
      // Mock GET PR success
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: 'Some content' });

      // Mock PATCH PR error
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(500, { message: 'Internal error' });

      await expect(github.deletePrLink()).rejects.toThrow();
    });

    test('should handle PR with no review app links', async () => {
      const originalBody = 'Just regular PR description';

      // Mock GET PR
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: originalBody });

      // Mock PATCH PR
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`, {
          body: originalBody,
        })
        .reply(200, { body: originalBody });

      const response = await github.deletePrLink();

      expect(response.status).toBe(200);
    });
  });

  describe('markPrLink', () => {
    test('should mark link as pending', async () => {
      const originalBody = '## Review App: [https://pr123.example.com](https://pr123.example.com) 🚀\r\nContent';
      const expectedBody = '## Review App: [https://pr123.example.com](https://pr123.example.com) ⏳\r\nContent';

      // Mock GET PR
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: originalBody });

      // Mock PATCH PR
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`, {
          body: expectedBody,
        })
        .reply(200, { body: expectedBody });

      const response = await github.markPrLink(true);

      expect(response.status).toBe(200);
    });

    test('should mark link as ready', async () => {
      const originalBody = '## Review App: [https://pr123.example.com](https://pr123.example.com) ⏳\r\nContent';
      const expectedBody = '## Review App: [https://pr123.example.com](https://pr123.example.com) 🚀\r\nContent';

      // Mock GET PR
      nock(GITHUB_BASE_URL)
        .get(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`)
        .reply(200, { body: originalBody });

      // Mock PATCH PR
      nock(GITHUB_BASE_URL)
        .patch(`/repos/${TEST_REPO}/pulls/${TEST_PR_NUMBER}`, {
          body: expectedBody,
        })
        .reply(200, { body: expectedBody });

      const response = await github.markPrLink(false);

      expect(response.status).toBe(200);
    });
  });
});
