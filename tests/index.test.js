const heracudo = require('../lib/index');

describe('heracudo index', () => {
  test('should export all main functions', () => {
    expect(heracudo).toHaveProperty('markPending');
    expect(heracudo).toHaveProperty('markReady');
    expect(heracudo).toHaveProperty('postDeploy');
    expect(heracudo).toHaveProperty('preDestroy');
  });

  test('should export functions that are callable', () => {
    expect(typeof heracudo.markPending).toBe('function');
    expect(typeof heracudo.markReady).toBe('function');
    expect(typeof heracudo.postDeploy).toBe('function');
    expect(typeof heracudo.preDestroy).toBe('function');
  });

  test('should have correct function references', () => {
    const markPending = require('../lib/markPending');
    const markReady = require('../lib/markReady');
    const postDeploy = require('../lib/postDeploy');
    const preDestroy = require('../lib/preDestroy');

    expect(heracudo.markPending).toBe(markPending);
    expect(heracudo.markReady).toBe(markReady);
    expect(heracudo.postDeploy).toBe(postDeploy);
    expect(heracudo.preDestroy).toBe(preDestroy);
  });
});
