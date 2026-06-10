module.exports = async () => {
  const formatError = require('./helpers/formatError');

  try {
    const { parseDomain } = require('parse-domain');

    const cloudflare = require('./api/cloudflare');
    const heroku = require('./api/heroku');
    const asyncForEach = require('./helpers/asyncForEach');
    const getCfZoneIds = require('./helpers/getCfZoneIds');

    const { data: domains } = await heroku.getDomains();

    await asyncForEach(domains, async ({ cname, hostname }) => {
      try {
        const {
          topLevelDomains,
          domain,
        } = parseDomain(hostname.trim());

        const fullDomain = `${domain}.${topLevelDomains.join('.')}`;

        const zone = getCfZoneIds().find((item) => item.domain === fullDomain);

        // No zone = not a domain we manage (e.g. *.herokuapp.com), leave it alone
        if (!zone) return;

        const { data: { result: dnsRecords } } = await cloudflare.getDnsRecords(zone.zoneId);

        const dnsRecord = dnsRecords.find(({ content }) => content === cname);

        if (dnsRecord) await cloudflare.deleteDnsRecord(zone.zoneId, dnsRecord.id);

        await heroku.deleteDomain(hostname);
      } catch (error) {
        console.error(`[heracudo] predestroy cleanup failed for "${hostname}": ${formatError(error)}`); // eslint-disable-line
      }
    });
  } catch (error) {
    console.error(error); // eslint-disable-line
    process.exit(1);
    return; // process.exit is mocked in tests
  }

  try {
    await require('./api/github').deletePrLink();
  } catch (error) {
    console.error(`[heracudo] Github PR update failed: ${formatError(error)}`); // eslint-disable-line
  }
};
