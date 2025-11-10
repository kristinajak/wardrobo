/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    clothingItem: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

// Mock fetch for OpenAI API
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('POST /api/ai/query', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return 415 for non-JSON content type', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(415)
    expect(data.error).toBe('Content-Type must be application/json')
  })

  it('should return 400 when prompt is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing prompt')
  })

  it('should return 400 when prompt is empty string', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing prompt')
  })

  it('should return 502 when OpenAI API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'blue shirt' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toBe('OPENAI_API_KEY is not configured')
  })

  it('should query items using AI-extracted filters', async () => {
    // Mock OpenAI response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'TOP',
                color: 'blue',
                search: 'shirt',
              }),
            },
          },
        ],
      }),
    } as Response)

    // Mock Prisma response
    const mockItems = [
      {
        id: 1,
        name: 'Blue Shirt',
        category: 'TOP',
        primaryColor: 'blue',
        colors: ['blue'],
        sizes: ['M'],
        images: [],
        createdAt: new Date(),
      },
    ]
    mockPrisma.$transaction.mockResolvedValue([mockItems, 1])

    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'show me blue shirts' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(data.data[0]).toMatchObject({
      id: 1,
      name: 'Blue Shirt',
      category: 'TOP',
    })
    expect(data.meta).toEqual({
      page: 1,
      perPage: 12,
      total: 1,
      totalPages: 1,
    })

    // Verify OpenAI was called
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    )
  })

  it('should handle OpenAI API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response)

    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'blue shirt' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(502)
    expect(data.error).toContain('OpenAI API error')
  })

  it('should handle malformed OpenAI responses gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'not valid json',
            },
          },
        ],
      }),
    } as Response)

    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'blue shirt' }),
    })

    const response = await POST(request)

    // Should still return results (with empty filters)
    expect(response.status).toBe(200)
  })

  it('should use seed color from request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                search: 'shirt',
              }),
            },
          },
        ],
      }),
    } as Response)

    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'shirt',
        color: 'red',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('should handle pagination parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ search: 'shirt' }),
            },
          },
        ],
      }),
    } as Response)

    mockPrisma.$transaction.mockResolvedValue([[], 50])

    const request = new NextRequest('http://localhost:3000/api/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'shirt',
        page: 2,
        perPage: 20,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.meta).toEqual({
      page: 2,
      perPage: 20,
      total: 50,
      totalPages: 3,
    })
  })
})

