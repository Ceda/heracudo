const axios = require('axios');

const required = require('../helpers/required');

const TRELLO_API_KEY = process.env.HRCD_TRELLO_API_KEY
  || process.env.TRELLO_API_KEY
  || required('HRCD_TRELLO_API_KEY | TRELLO_API_KEY');
const TRELLO_API_TOKEN = process.env.HRCD_TRELLO_API_TOKEN
  || process.env.TRELLO_API_TOKEN
  || required('HRCD_TRELLO_API_TOKEN | TRELLO_API_TOKEN');

const HRCD_GITHUB_LINK_MARKER = process.env.HRCD_GITHUB_LINK_MARKER || '## Review App:';
const HEROKU_BRANCH = process.env.HEROKU_BRANCH || required('HEROKU_BRANCH');

const splitter = '\r\n';

const api = axios.create({
  baseURL: 'https://api.trello.com/1/',
  headers: {
    Accept: 'application/json',
  },
});

const searchCardId = () => api.get('search', {
  params: {
    query: HEROKU_BRANCH,
    modelTypes: 'cards',
    key: TRELLO_API_KEY,
    token: TRELLO_API_TOKEN,
  },
})
  .catch((e) => { throw e; });

const commentTrelloCard = (cardId, commentText) => api.post(`cards/${cardId}/actions/comments`, null, {
  params: {
    text: commentText,
    key: TRELLO_API_KEY,
    token: TRELLO_API_TOKEN,
  },
})
  .catch((e) => { throw e; });

const createComment = async (hostname = required('hostname')) => {
  const { data } = await searchCardId();
  let cardId = null;

  if (data && data.cards && data.cards.length > 0) {
    cardId = data.cards[0].id;
  }

  const newPrBody = [`${HRCD_GITHUB_LINK_MARKER} ${hostname}`].join(splitter);

  if (cardId) {
    await commentTrelloCard(cardId, newPrBody);
  }
};

module.exports = {
  createComment,
};
