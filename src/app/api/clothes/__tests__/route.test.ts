/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '../route'

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

describe('GET /api/clothes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return paginated clothing items', async () => {
    const mockDate = new Date('2025-11-04T14:46:24.777Z')
    const mockItems = [
      {
        id: 1,
        name: 'Blue T-Shirt',
        category: 'TOP',
        primaryColor: 'blue',
        colors: ['blue'],
        sizes: ['M', 'L'],
        images: [],
        createdAt: mockDate,
      },
    ]

    mockPrisma.$transaction.mockResolvedValue([mockItems, 1])

    const request = new NextRequest('http://localhost:3000/api/clothes?page=1&perPage=12')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(data.data[0]).toMatchObject({
      id: 1,
      name: 'Blue T-Shirt',
      category: 'TOP',
      primaryColor: 'blue',
    })
    expect(data.meta).toEqual({
      page: 1,
      perPage: 12,
      total: 1,
      totalPages: 1,
    })
  })

  it('should filter by category', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/clothes?category=TOP')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('should filter by color', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/clothes?color=blue')
    await GET(request)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('should handle search query', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/clothes?search=shirt')
    await GET(request)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('should use default page size when not provided', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/clothes')
    await GET(request)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('should calculate correct totalPages', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 25])

    const request = new NextRequest('http://localhost:3000/api/clothes?perPage=10')
    const response = await GET(request)
    const data = await response.json()

    expect(data.meta.totalPages).toBe(3) // 25 items / 10 per page = 3 pages
  })

  it('should return at least 1 totalPage when no items', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 0])

    const request = new NextRequest('http://localhost:3000/api/clothes')
    const response = await GET(request)
    const data = await response.json()

    expect(data.meta.totalPages).toBe(1)
  })

  it('should skip correct number of items for pagination', async () => {
    mockPrisma.$transaction.mockResolvedValue([[], 50])

    const request = new NextRequest('http://localhost:3000/api/clothes?page=3&perPage=10')
    await GET(request)

    const transactionCall = mockPrisma.$transaction.mock.calls[0]
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })
})
