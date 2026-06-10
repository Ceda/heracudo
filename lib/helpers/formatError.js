module.exports = (error) => {
  if (!error.response) return error.message;

  const { status, data } = error.response;

  return `HTTP ${status}: ${JSON.stringify(data)}`;
};
