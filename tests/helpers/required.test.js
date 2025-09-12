const required = require('../../lib/helpers/required');

describe('required helper', () => {
  test('should throw error with variable name', () => {
    expect(() => required('TEST_VAR')).toThrow('"TEST_VAR" required but not defined.');
  });

  test('should throw error with generic message when no name provided', () => {
    expect(() => required()).toThrow('Variable required but not defined.');
  });

  test('should throw SyntaxError', () => {
    expect(() => required('TEST')).toThrow(SyntaxError);
  });
});
