module.exports = async () => {
  const formatError = require('./helpers/formatError');

  const reviewAppHostnames = [];
  const failedHostnames = [];
  let hostnames = [];

  try {
    const { parseDomain } = require('parse-domain');

    const cloudflare = require('./api/cloudflare');
    const heroku = require('./api/heroku');
    const required = require('./helpers/required');
    const asyncForEach = require('./helpers/asyncForEach');

    const getCfZoneIds = require('./helpers/getCfZoneIds');

    const HOSTNAME = process.env.HRCD_HOSTNAME
      || process.env.HOSTNAME
      || required('HRCD_HOSTNAME | HOSTNAME');

    const reviewAppName = heroku.getAppName();

    hostnames = HOSTNAME.split(',').map((hostname) => hostname.trim());

    await asyncForEach(hostnames, async (hostname) => {
      try {
        const zone = getCfZoneIds().find((item) => item.domain === hostname);

        if (!zone) throw new Error(`No Cloudflare zone ID configured for "${hostname}".`);

        const {
          hostname: fullDomain,
          subDomains,
        } = parseDomain(hostname);

        const subdomain = subDomains.join('.');

        let reviewAppSubdomain = subdomain && `-${subdomain}`;
        let reviewAppHostname = `${reviewAppSubdomain}.${fullDomain}`;

        reviewAppSubdomain = reviewAppName + reviewAppSubdomain;
        reviewAppHostname = reviewAppName + reviewAppHostname;

        const { cname } = await heroku.createDomain(reviewAppHostname)
          .then(({ data }) => data)
          .catch(async (error) => {
            // 422 = domain is already added to the app; reuse it instead of failing
            if (error.response && error.response.status === 422) {
              return heroku.getDomains(reviewAppHostname).then(({ data }) => data);
            }
            throw error;
          });

        await cloudflare.createDnsRecord(zone.zoneId, reviewAppSubdomain, cname)
          .catch((error) => {
            if (cloudflare.isExistingRecordError(error)) return null;
            throw error;
          });

        reviewAppHostnames.push(`https://${reviewAppHostname}`);
      } catch (error) {
        failedHostnames.push(hostname);
        console.error(`[heracudo] postdeploy failed for "${hostname}": ${formatError(error)}`); // eslint-disable-line
      }
    });
  } catch (error) {
    console.error(error); // eslint-disable-line
    process.exit(1);
    return; // process.exit is mocked in tests
  }

  if (reviewAppHostnames.length > 0) {
    try {
      await require('./api/github').createPrLinks(reviewAppHostnames);
    } catch (error) {
      console.error(`[heracudo] Github PR update failed: ${formatError(error)}`); // eslint-disable-line
    }

    try {
      await require('./api/jira').createComment(`\n${reviewAppHostnames.join('\n')}`);
    } catch (error) {
      console.error(`[heracudo] Jira update failed: ${formatError(error)}`); // eslint-disable-line
    }
  }

  if (failedHostnames.length > 0) {
    console.error(`[heracudo] ${failedHostnames.length}/${hostnames.length} hostnames failed: ${failedHostnames.join(', ')}`); // eslint-disable-line
    if (reviewAppHostnames.length === 0) process.exit(1);
  }
};
