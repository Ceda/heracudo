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

const searchIssue = () => api.get('search', {
  params: {
    jql: `summary ~ "${HEROKU_BRANCH}" OR description ~ "${HEROKU_BRANCH}" OR comment ~ "${HEROKU_BRANCH}"`,
    fields: 'key,summary',
  },
})
  .catch((e) => { throw e; });

const addCommentToIssue = (issueKey, commentText) => api.post(`issue/${issueKey}/comment`, {
  body: {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: commentText,
          },
        ],
      },
    ],
  },
})
  .catch((e) => { throw e; });

const createComment = async (hostname = required('hostname')) => {
  const { data } = await searchIssue();
  let issueKey = null;

  if (data && data.issues && data.issues.length > 0) {
    issueKey = data.issues[0].key;
  }

  const commentText = `${HRCD_GITHUB_LINK_MARKER} ${hostname}`;

  if (issueKey) {
    await addCommentToIssue(issueKey, commentText);
  }
};

module.exports = {
  createComment,
};
