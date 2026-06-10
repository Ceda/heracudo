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

// Cloudflare error codes for "record already exists" responses
const EXISTING_RECORD_CODES = [81053, 81057, 81058];

module.exports = {
  isExistingRecordError: (error) => {
    const errors = (error.response && error.response.data && error.response.data.errors) || [];
    return errors.some(({ code }) => EXISTING_RECORD_CODES.includes(code));
  },
  getDnsRecords: (zoneID = required('zoneID'), id = '') => api
    .get(`${zoneID}/dns_records/${id}?per_page=100`)
    .catch((e) => { throw e; }),
  findDnsRecords: (zoneID = required('zoneID'), name = required('name')) => api
    .get(`${zoneID}/dns_records?name=${encodeURIComponent(name)}`)
    .catch((e) => { throw e; }),
  updateDnsRecord: (zoneID = required('zoneID'), id = required('id'), name = required('name'), content = required('content')) => api
    .put(`${zoneID}/dns_records/${id}`, {
      name,
      content,
      type: 'CNAME',
      proxied: true,
    })
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
