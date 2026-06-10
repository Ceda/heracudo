module.exports = async () => {
  try {
    if (process.env.HEROKU_APP_NAME && process.env.HEROKU_PR_NUMBER) {
      await require('./api/github').markPrLink(true);
    }
  } catch (e) {
    // Marking the PR link is cosmetic — never fail the build because of it
    console.error(e); // eslint-disable-line
  }
};
