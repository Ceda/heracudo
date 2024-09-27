module.exports = async () => {
  try {
    const { parseDomain } = require('parse-domain');

    const cloudflare = require('./api/cloudflare');
    const heroku = require('./api/heroku');
    const github = require('./api/github');
    const trello = require('./api/trello');
    const required = require('./helpers/required');
    const asyncForEach = require('./helpers/asyncForEach');

    const getCfZoneIds = require('./helpers/getCfZoneIds');

    const HOSTNAME = process.env.HRCD_HOSTNAME
      || process.env.HOSTNAME
      || required('HRCD_HOSTNAME | HOSTNAME');

    const reviewAppHostnames = [];

    await asyncForEach(HOSTNAME.split(','), async (hostname) => {
      const zone = getCfZoneIds().find((item) => item.domain === hostname);

      const {
        hostname: fullDomain,
        subDomains,
      } = parseDomain(hostname.trim());

      const subdomain = subDomains.join('.');

      let reviewAppSubdomain = subdomain && `-${subdomain}`;
      let reviewAppHostname = `${reviewAppSubdomain}.${fullDomain}`;

      const reviewAppName = heroku.getAppName();

      reviewAppSubdomain = reviewAppName + reviewAppSubdomain;
      reviewAppHostname = reviewAppName + reviewAppHostname;

      const {
        data: {
          cname,
        },
      } = await heroku.createDomain(reviewAppHostname);

      reviewAppHostnames.push(`https://${reviewAppHostname}`);

      await Promise.all([
        cloudflare.createDnsRecord(zone.zoneId, reviewAppSubdomain, cname),
        github.createPrLink(`https://${reviewAppHostname}`),
      ]);
    });

    if (reviewAppHostnames.length > 0) {
      const comment = `\n${reviewAppHostnames.join('\n')}`;
      await trello.createComment(comment);
    }
  } catch (e) {
    console.error(e); // eslint-disable-line
    process.exit(1);
  }
};
