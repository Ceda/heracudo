const nock = require('nock');

describe('jira API', () => {
  const JIRA_HOST = 'test.atlassian.net';
  const JIRA_BASE_URL = `https://${JIRA_HOST}`;
  const TEST_BRANCH = 'TEST-123-feature-branch';
  const TEST_ISSUE_KEY = 'TEST-123';
  let jira;

  beforeEach(() => {
    nock.cleanAll();
    // Set required environment variables for tests
    process.env.HRCD_JIRA_HOST = JIRA_HOST;
    process.env.HRCD_JIRA_EMAIL = 'test@example.com';
    process.env.HRCD_JIRA_API_TOKEN = 'test-token';
    process.env.HEROKU_BRANCH = TEST_BRANCH;

    // Clear require cache and reimport module with new ENV vars
    delete require.cache[require.resolve('../../lib/api/jira')];
    jira = require('../../lib/api/jira');

    // Suppress console logs in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.HRCD_JIRA_HOST;
    delete process.env.HRCD_JIRA_EMAIL;
    delete process.env.HRCD_JIRA_API_TOKEN;
    delete process.env.HEROKU_BRANCH;
    // Restore console.log
    jest.restoreAllMocks();
  });

  afterAll(() => {
    nock.cleanAll();
  });

  describe('createComment', () => {
    test('should update ReviewApps field on found issue', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = {
        issues: [
          {
            key: TEST_ISSUE_KEY,
            fields: { summary: 'Test issue' },
          },
        ],
      };

      const mockFieldsResponse = [
        {
          id: 'customfield_10329',
          name: 'ReviewApps',
          custom: true,
          schema: { type: 'string' },
        },
      ];

      // Mock search for issue
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search/jql')
        .query({
          jql: `key = "${TEST_ISSUE_KEY}" OR summary ~ "${TEST_ISSUE_KEY}" OR description ~ "${TEST_ISSUE_KEY}" OR comment ~ "${TEST_ISSUE_KEY}"`,
          fields: 'key,summary',
        })
        .reply(200, mockSearchResponse);

      // Mock field metadata
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/field')
        .reply(200, mockFieldsResponse);

      // Mock field update
      nock(JIRA_BASE_URL)
        .put(`/rest/api/3/issue/${TEST_ISSUE_KEY}`, {
          fields: {
            customfield_10329: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Review Apps: ',
                    },
                    {
                      type: 'text',
                      text: hostname,
                      marks: [
                        {
                          type: 'link',
                          attrs: {
                            href: hostname,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        })
        .reply(204);

      await jira.createComment(hostname);
    });

    test('should not update field when no issue found', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = { issues: [] };

      // Mock search for issue (no results)
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search/jql')
        .query({
          jql: `key = "${TEST_ISSUE_KEY}" OR summary ~ "${TEST_ISSUE_KEY}" OR description ~ "${TEST_ISSUE_KEY}" OR comment ~ "${TEST_ISSUE_KEY}"`,
          fields: 'key,summary',
        })
        .reply(200, mockSearchResponse);

      // Should not make field or update requests
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
        .get('/rest/api/3/search/jql')
        .query(true)
        .reply(500, { message: 'Internal server error' });

      await expect(jira.createComment(hostname)).rejects.toThrow();
    });

    test('should handle field API errors', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = {
        issues: [{ key: TEST_ISSUE_KEY }],
      };

      // Mock search success
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search/jql')
        .query(true)
        .reply(200, mockSearchResponse);

      // Mock field metadata error
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/field')
        .reply(403, { message: 'Forbidden' });

      await expect(jira.createComment(hostname)).rejects.toThrow();
    });

    test('should handle field update API error', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = {
        issues: [{ key: TEST_ISSUE_KEY }],
      };

      const mockFieldsResponse = [
        {
          id: 'customfield_10329',
          name: 'ReviewApps',
          custom: true,
        },
      ];

      // Mock search success
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search/jql')
        .query(true)
        .reply(200, mockSearchResponse);

      // Mock field metadata success
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/field')
        .reply(200, mockFieldsResponse);

      // Mock field update error
      nock(JIRA_BASE_URL)
        .put(`/rest/api/3/issue/${TEST_ISSUE_KEY}`)
        .reply(403, { message: 'Forbidden' });

      await expect(jira.createComment(hostname)).rejects.toThrow();
    });

    test('should handle missing ReviewApps field', async () => {
      const hostname = 'https://pr123.example.com';
      const mockSearchResponse = {
        issues: [{ key: TEST_ISSUE_KEY }],
      };

      const mockFieldsResponse = [
        {
          id: 'customfield_10999',
          name: 'SomeOtherField',
          custom: true,
        },
      ];

      // Mock search success
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/search/jql')
        .query(true)
        .reply(200, mockSearchResponse);

      // Mock field metadata (without ReviewApps field)
      nock(JIRA_BASE_URL)
        .get('/rest/api/3/field')
        .reply(200, mockFieldsResponse);

      await expect(jira.createComment(hostname)).rejects.toThrow('ReviewApps field not found');
    });
  });
});
