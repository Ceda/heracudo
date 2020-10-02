module.exports = async () => {
  try {
    const { parseDomain } = require('parse-domain');

    const cloudflare = require('./api/cloudflare');
    const heroku = require('./api/heroku');
    const github = require('./api/github');
    const getCfZoneIds = require('./helpers/getCfZoneIds');

    const { data: domains } = await heroku.getDomains();

    const promises = await domains.reduce(async (acc, { cname, hostname }) => {
      const {
        hostname: fullDomain,
      } = parseDomain(hostname.trim());

      const zone = getCfZoneIds().find((item) => item.domain === `${fullDomain}`);

      if (!zone) return acc;

      const { data: { result: dnsRecords } } = await cloudflare.getDnsRecords(zone.zoneId);

      const dnsRecord = dnsRecords.find(({ content }) => content === cname);

      if (!dnsRecord) return acc;

      return [
        cloudflare.deleteDnsRecord(zone.zoneId, dnsRecord.id),
        heroku.deleteDomain(hostname),
      ];
    }, []);

    await Promise.all([
      ...promises,
      github.deletePrLink(),
    ]);
  } catch (e) {
    console.error(e); // eslint-disable-line
    process.exit(1);
  }
};
