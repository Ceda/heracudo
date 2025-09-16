const axios = require('axios');

const required = require('../helpers/required');

const JIRA_HOST = process.env.HRCD_JIRA_HOST
  || process.env.JIRA_HOST
  || required('HRCD_JIRA_HOST | JIRA_HOST');
const JIRA_EMAIL = process.env.HRCD_JIRA_EMAIL
  || process.env.JIRA_EMAIL
  || required('HRCD_JIRA_EMAIL | JIRA_EMAIL');
const JIRA_API_TOKEN = process.env.HRCD_JIRA_API_TOKEN
  || process.env.JIRA_API_TOKEN
  || required('HRCD_JIRA_API_TOKEN | JIRA_API_TOKEN');

const HRCD_GITHUB_LINK_MARKER = process.env.HRCD_GITHUB_LINK_MARKER || 'Review Apps:';
const HEROKU_BRANCH = process.env.HEROKU_BRANCH || required('HEROKU_BRANCH');

const api = axios.create({
  baseURL: `https://${JIRA_HOST}/rest/api/3/`,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  auth: {
    username: JIRA_EMAIL,
    password: JIRA_API_TOKEN,
  },
});

const getIssueKeyFromBranch = (branchName) => {
  // Extract issue key from branch name (e.g., "DV-478-jira-integration" -> "DV-478")
  const match = branchName.match(/^([A-Z]+-\d+)/);
  return match ? match[1] : branchName;
};

const searchIssue = () => {
  const issueKey = getIssueKeyFromBranch(HEROKU_BRANCH);
  return api.get('search/jql', {
    params: {
      jql: `key = "${issueKey}" OR summary ~ "${issueKey}" OR description ~ "${issueKey}" OR comment ~ "${issueKey}"`,
      fields: 'key,summary',
    },
  })
    .catch((e) => { throw e; });
};

const updateReviewAppsField = async (issueKey, hostname) => {
  // First get field metadata to find ReviewApps field ID
  const { data: fields } = await api.get('field');
  const reviewAppsField = fields.find((field) => field.name === 'ReviewApps');

  if (!reviewAppsField) {
    throw new Error('ReviewApps field not found');
  }

  // Update the field with formatted text
  return api.put(`issue/${issueKey}`, {
    fields: {
      [reviewAppsField.id]: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `${HRCD_GITHUB_LINK_MARKER} `,
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
    .catch((e) => { throw e; });
};

const createComment = async (hostname = required('hostname')) => {
  const { data } = await searchIssue();

  let issueKey = null;

  if (data && data.issues && data.issues.length > 0) {
    issueKey = data.issues[0].key;
  }

  if (issueKey) {
    await updateReviewAppsField(issueKey, hostname);
  }
};

module.exports = {
  createComment,
};
