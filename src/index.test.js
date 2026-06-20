import app from '.'

describe('Test the application', () => {
  it('Should redirect a location-less request to a default location', async () => {
    const res = await app.request('http://localhost/')
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toContain('lat=')
    expect(res.headers.get('Location')).toContain('lng=')
  })
})
