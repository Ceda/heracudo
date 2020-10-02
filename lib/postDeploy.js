module.exports = async () => {
  try {
    const parseDomain = require('parse-domain');

    const cloudflare = require('./api/cloudflare');
    const heroku = require('./api/heroku');
    const github = require('./api/github');
    const required = require('./helpers/required');
    const asyncForEach = require('./helpers/asyncForEach');

    const getCfZoneIds = require('./helpers/getCfZoneIds');

    const HOSTNAME = process.env.HRCD_HOSTNAME
      || process.env.HOSTNAME
      || required('HRCD_HOSTNAME | HOSTNAME');

    await asyncForEach(HOSTNAME.split(','), async (hostname) => {
      const zone = getCfZoneIds().find((item) => item.domain === hostname);

      const {
        data: {
          result: dnsRecords,
        },
      } = await cloudflare.getDnsRecords(zone.zoneId);

      const {
        subdomain,
        domain,
        tld,
      } = parseDomain(hostname.trim());

      let reviewAppSubdomain = subdomain && `-${subdomain}`;
      let reviewAppHostname = `${reviewAppSubdomain}.${domain}.${tld}`;
      const reviewAppDnsRecords = dnsRecords.filter(({ name }) => name.match(new RegExp(`^[0-9]${reviewAppHostname}`)));

      let appNum = 1;
      if (reviewAppDnsRecords.length) {
        const existingNums = reviewAppDnsRecords.map(({ name }) => Number(name.split('-')[0]));
        while (existingNums.includes(appNum)) appNum += 1;
      }

      reviewAppSubdomain = appNum + reviewAppSubdomain;
      reviewAppHostname = appNum + reviewAppHostname;

      const {
        data: {
          cname,
        },
      } = await heroku.createDomain(reviewAppHostname);

      await Promise.all([
        cloudflare.createDnsRecord(zone.zoneId, reviewAppSubdomain, cname),
        github.createPrLink(`https://${reviewAppHostname}`),
      ]);
    });
  } catch (e) {
    console.error(e); // eslint-disable-line
    process.exit(1);
  }
};
