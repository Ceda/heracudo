const nock = require('nock');
const jira = require('../../lib/api/jira');

describe('jira API', () => {
  const JIRA_HOST = 'test.atlassian.net';
  const JIRA_BASE_URL = `https://${JIRA_HOST}`;
  const TEST_BRANCH = 'feature/test-branch';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('createComment', () => {
    test('should add comment to found issue', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = {
        issues: [
          {
            key: 'TEST-123',
            fields: { summary: 'Test issue' },
          },
        ],
      };

      const mockCommentResponse = {
        id: 'comment-id',
        body: {
          content: [
            {
              content: [
                { text: `Review Apps: ${hostname}` },
              ],
            },
          ],
        },
      };

      // Mock search for issue
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search')
        .query({
          jql: `summary ~ "${TEST_BRANCH}" OR description ~ "${TEST_BRANCH}" OR comment ~ "${TEST_BRANCH}"`,
          fields: 'key,summary',
        })
        .reply(200, mockSearchResponse);

      // Mock add comment
      nock(JIRA_BASE_URL)
        .post('/rest/api/3/issue/TEST-123/comment', {
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Review Apps: ${hostname}`,
                  },
                ],
              },
            ],
          },
        })
        .reply(201, mockCommentResponse);

      await jira.createComment(hostname);
    });

    test('should not add comment when no issue found', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = { issues: [] };

      // Mock search for issue (no results)
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search')
        .query({
          jql: `summary ~ "${TEST_BRANCH}" OR description ~ "${TEST_BRANCH}" OR comment ~ "${TEST_BRANCH}"`,
          fields: 'key,summary',
        })
        .reply(200, mockSearchResponse);

      // Should not make comment request
      await jira.createComment(hostname);
    });

    test('should throw error when hostname is missing', async () => {
      await expect(async () => {
        await jira.createComment();
      }).rejects.toThrow('"hostname" required but not defined.');
    });

    test('should handle search API error', async () => {
      const hostname = 'https://pr123.example.com';

      // Mock search error
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search')
        .query(true)
        .reply(500, { message: 'Internal server error' });

      await expect(jira.createComment(hostname)).rejects.toThrow();
    });

    test('should handle comment API error', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = {
        issues: [{ key: 'TEST-123' }],
      };

      // Mock search success
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search')
        .query(true)
        .reply(200, mockSearchResponse);

      // Mock comment error
      nock(JIRA_BASE_URL)
        .post('/rest/api/3/issue/TEST-123/comment')
        .reply(403, { message: 'Forbidden' });

      await expect(jira.createComment(hostname)).rejects.toThrow();
    });
  });
});
