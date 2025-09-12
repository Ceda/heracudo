const asyncForEach = require('../../lib/helpers/asyncForEach');

describe('asyncForEach helper', () => {
  test('should call callback for each item', async () => {
    const array = ['a', 'b', 'c'];
    const callback = jest.fn().mockResolvedValue(true);

    await asyncForEach(array, callback);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenNthCalledWith(1, 'a', 0, array);
    expect(callback).toHaveBeenNthCalledWith(2, 'b', 1, array);
    expect(callback).toHaveBeenNthCalledWith(3, 'c', 2, array);
  });

  test('should handle empty array', async () => {
    const callback = jest.fn();

    await asyncForEach([], callback);

    expect(callback).not.toHaveBeenCalled();
  });

  test('should wait for async callbacks', async () => {
    const results = [];
    const callback = jest.fn(async (item, index) => {
      await new Promise((resolve) => setTimeout(resolve, 50 - index * 10));
      results.push(item);
    });

    await asyncForEach(['a', 'b', 'c'], callback);

    expect(results).toEqual(['a', 'b', 'c']);
  });
});
