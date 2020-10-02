const required = require('./required');

const HOSTNAME = process.env.HRCD_HOSTNAME
      || process.env.HOSTNAME
      || required('HRCD_HOSTNAME | HOSTNAME');

const CLOUDFLARE_ZONE_ID = process.env.HRCD_CLOUDFLARE_ZONE_ID
  || process.env.CLOUDFLARE_ZONE_ID
  || required('HRCD_CLOUDFLARE_ZONE_ID | CLOUDFLARE_ZONE_ID');

const CLOUDFLARE_ZONE_IDS = CLOUDFLARE_ZONE_ID.split(',');
const HOSTNAMES = HOSTNAME.split(',');

module.exports = () => {
  if (CLOUDFLARE_ZONE_IDS.length !== HOSTNAMES.length) {
    throw new SyntaxError('CLOUDFLARE_ZONE_ID items length not match HOSTNAME length.');
  }

  return HOSTNAMES.map((hostmame, index) => (
    { domain: hostmame, zoneId: CLOUDFLARE_ZONE_IDS[index] }
  ));
};
