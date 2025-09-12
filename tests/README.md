# Heracudo Test Suite

Kompletná test suite pre Heracudo projekt pokrývajúca všetky moduly a API integrácie.

## Test Coverage

**Current coverage: 87.71% statements**

- **API moduly**: 93.97% coverage
- **Helper funkcie**: 100% coverage
- **Hlavné moduly**: 77.46% coverage

## Spustenie testov

```bash
# Všetky testy
yarn test

# Testy s coverage reportom
yarn test:coverage

# Testy v watch mode
yarn test:watch
```

## Štruktúra testov

```
tests/
├── setup.js                 # Globálny test setup
├── api/                      # API integrácie testy
│   ├── cloudflare.test.js   # Cloudflare DNS API
│   ├── github.test.js       # GitHub PR API
│   ├── heroku.test.js       # Heroku Domain API
│   └── jira.test.js         # Jira API
├── helpers/                  # Helper funkcie testy
│   ├── asyncForEach.test.js # Async iteration helper
│   ├── getCfZoneIds.test.js # Cloudflare zone mapping
│   └── required.test.js     # Environment validation
├── index.test.js            # Main export testy
├── markPending.test.js      # Mark PR pending funkcia
├── markReady.test.js        # Mark PR ready funkcia
├── postDeploy.test.js       # Post-deploy lifecycle
└── preDestroy.test.js       # Pre-destroy cleanup
```

## Test Setup

### Environment Variables
Testy používajú mock environment variables definované v `setup.js`:

```javascript
process.env.HRCD_HOSTNAME = 'test.example.com';
process.env.HRCD_HEROKU_TOKEN = 'test-heroku-token';
process.env.HRCD_CLOUDFLARE_ZONE_ID = 'test-zone-id';
// ... atď
```

### Mocking Strategy

1. **HTTP Requests**: `nock` pre mock API calls
2. **Process Exit**: `process.exit` je mocknutý
3. **Console**: `console.error` je mocknutý
4. **Modules**: `jest.mock()` pre dependency injection

## API Tests

### Cloudflare API Tests
- DNS record creation/deletion
- Zone management
- Error handling

### GitHub API Tests
- PR description updates
- Link status changes (pending/ready)
- Comment management

### Heroku API Tests
- Domain creation/deletion
- App management
- Error scenarios

### Jira API Tests
- Issue searching
- Comment creation
- Authentication handling

## Integration Tests

### PostDeploy Tests
- Domain creation workflow
- Multi-hostname support
- Service integration
- Error handling

### PreDestroy Tests
- Cleanup workflow
- DNS record removal
- PR link removal

### Status Update Tests
- Mark pending/ready functionality
- Conditional execution
- GitHub integration

## Test Patterns

### Error Handling Tests
```javascript
test('should handle API errors gracefully', async () => {
  // Mock API error
  nock('https://api.example.com')
    .get('/endpoint')
    .reply(500, { message: 'Error' });

  await functionUnderTest();

  // Check process.exit was called
  expect(process.exit).toHaveBeenCalledWith(1);
});
```

### Required Parameter Tests
```javascript
test('should throw error when parameter missing', async () => {
  try {
    await functionWithRequiredParam();
    fail('Expected function to throw');
  } catch (error) {
    expect(error.message).toBe('"param" required but not defined.');
  }
});
```

### HTTP Mock Tests
```javascript
test('should call API correctly', async () => {
  nock('https://api.example.com')
    .post('/endpoint', { data: 'test' })
    .reply(200, { success: true });

  const result = await apiFunction('test');

  expect(result.data).toEqual({ success: true });
});
```

## Coverage Goals

- **Statements**: > 90%
- **Branches**: > 80%
- **Functions**: > 90%
- **Lines**: > 90%

## Contributing

Pri pridávaní nových funkcií:

1. Vytvor test súbor v správnej zložke
2. Pokri všetky code paths
3. Test error scenarios
4. Mock externé dependencies
5. Dodržuj existujúce test patterns

## Debugging Tests

```bash
# Debug konkrétny test
yarn test tests/api/jira.test.js

# Debug s verbose outputom
yarn test --verbose

# Debug konkrétny test case
yarn test -t "should create comment"
```
