const axios = require('axios');

const required = require('../helpers/required');

const CLOUDFLARE_TOKEN = process.env.HRCD_CLOUDFLARE_TOKEN
  || process.env.CLOUDFLARE_TOKEN
  || required('HRCD_CLOUDFLARE_TOKEN | CLOUDFLARE_TOKEN');

const api = axios.create({
  baseURL: 'https://api.cloudflare.com/client/v4/zones/',
  headers: {
    Authorization: `Bearer ${CLOUDFLARE_TOKEN}`,
  },
});

module.exports = {
  getDnsRecords: (zoneID = required('zoneID'), id = '') => api
    .get(`${zoneID}/dns_records/${id}?per_page=100`)
    .catch((e) => { throw e; }),
  createDnsRecord: (zoneID = required('zoneID'), name = required('name'), content = required('content')) => api
    .post(`${zoneID}/dns_records`, {
      name,
      content,
      type: 'CNAME',
      proxied: true,
    })
    .catch((e) => { throw e; }),
  deleteDnsRecord: (zoneID = required('zoneID'), id = required('id')) => api
    .delete(`${zoneID}/dns_records/${id}`)
    .catch((e) => { throw e; }),
};
