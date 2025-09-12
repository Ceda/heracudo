// Test setup
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.HRCD_HOSTNAME = 'test.example.com';
process.env.HRCD_HEROKU_TOKEN = 'test-heroku-token';
process.env.HRCD_CLOUDFLARE_ZONE_ID = 'test-zone-id';
process.env.HRCD_CLOUDFLARE_TOKEN = 'test-cloudflare-token';
process.env.HRCD_GITHUB_TOKEN = 'test-github-token';
process.env.HRCD_GITHUB_REPOSITORY = 'user/repo';
process.env.HRCD_JIRA_HOST = 'test.atlassian.net';
process.env.HRCD_JIRA_EMAIL = 'test@example.com';
process.env.HRCD_JIRA_API_TOKEN = 'test-jira-token';
process.env.HEROKU_APP_NAME = 'test-app-123';
process.env.HEROKU_PR_NUMBER = '456';
process.env.HEROKU_BRANCH = 'feature/test-branch';

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
process.exit = jest.fn();

// Disable console.error during tests
const originalConsoleError = console.error;
console.error = jest.fn();

afterAll(() => {
  process.exit = originalExit;
  console.error = originalConsoleError;
});
