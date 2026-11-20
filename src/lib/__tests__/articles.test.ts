import { getArticle } from '../articles'

describe('getArticle', () => {
  it('rejects a path-like slug as a missing article', async () => {
    await expect(getArticle('../secret')).rejects.toMatchObject({
      code: 'ENOENT',
      message: 'Article not found: ../secret',
    })
  })
})
