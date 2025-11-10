import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClothingExplorer } from '../clothing-explorer'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />
  },
}))

// Mock fetch
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('ClothingExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render with initial data', () => {
    const initialData = {
      data: [
        {
          id: 1,
          name: 'Blue T-Shirt',
          category: 'TOP',
          primaryColor: 'blue',
          colors: ['blue'],
          sizes: ['M'],
          images: [],
          createdAt: '2025-11-04T12:00:00Z',
        },
      ],
      meta: {
        page: 1,
        perPage: 12,
        total: 1,
        totalPages: 1,
      },
    }

    render(<ClothingExplorer initialData={initialData} />)

    expect(screen.getAllByText('Blue T-Shirt')).toHaveLength(2)
    expect(screen.getByText('Showing 1 of 1 items')).toBeInTheDocument()
  })

  it('should render empty state when no items', () => {
    const initialData = {
      data: [],
      meta: {
        page: 1,
        perPage: 12,
        total: 0,
        totalPages: 1,
      },
    }

    render(<ClothingExplorer initialData={initialData} />)

    expect(
      screen.getByText(/No items match your filters yet/i)
    ).toBeInTheDocument()
  })

  it('should display search input', () => {
    render(<ClothingExplorer />)

    const searchInput = screen.getByPlaceholderText(/Search for/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('should update search input on typing', async () => {
    const user = userEvent.setup()
    render(<ClothingExplorer />)

    const searchInput = screen.getByPlaceholderText(/Search for/i)
    await user.type(searchInput, 'blue shirt')

    expect(searchInput).toHaveValue('blue shirt')
  })

  it('should show clear button when search has text', async () => {
    const user = userEvent.setup()
    render(<ClothingExplorer />)

    const searchInput = screen.getByPlaceholderText(/Search for/i)
    
    // Clear button should not be visible initially
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

    await user.type(searchInput, 'blue')

    // Clear button should appear
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('should clear search when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<ClothingExplorer />)

    const searchInput = screen.getByPlaceholderText(/Search for/i) as HTMLInputElement
    await user.type(searchInput, 'blue shirt')

    expect(searchInput.value).toBe('blue shirt')

    const clearButton = screen.getByLabelText('Clear search')
    await user.click(clearButton)

    expect(searchInput.value).toBe('')
  })

  it('should debounce search and call AI API', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 2,
              name: 'Red Shirt',
              category: 'TOP',
              primaryColor: 'red',
              colors: ['red'],
              sizes: ['L'],
              images: [],
              createdAt: '2025-11-04T12:00:00Z',
            },
          ],
          meta: { page: 1, perPage: 12, total: 1, totalPages: 1 },
        }),
      } as Response)
    })

    render(<ClothingExplorer />)

    const searchInput = screen.getByPlaceholderText(/Search for/i)
    await user.type(searchInput, 'red shirt')

    // Wait for debounce
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/ai/query',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: 'red shirt',
              page: 1,
              perPage: 12,
            }),
          })
        )
      },
      { timeout: 2000 }
    )

    // Wait for results to appear (name appears twice)
    await waitFor(() => {
      expect(screen.getAllByText('Red Shirt').length).toBeGreaterThan(0)
    })
  })

  it('should display error message on API failure', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    render(<ClothingExplorer />)

    const searchInput = screen.getByPlaceholderText(/Search for/i)
    await user.type(searchInput, 'shirt')

    await waitFor(
      () => {
        expect(screen.getByText(/Request failed with status 500/i)).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('should render multiple clothing items', () => {
    const initialData = {
      data: [
        {
          id: 1,
          name: 'Blue T-Shirt',
          category: 'TOP',
          primaryColor: 'blue',
          colors: ['blue'],
          sizes: ['M'],
          images: [],
          createdAt: '2025-11-04T12:00:00Z',
        },
        {
          id: 2,
          name: 'Red Pants',
          category: 'BOTTOM',
          primaryColor: 'red',
          colors: ['red'],
          sizes: ['L'],
          images: [],
          createdAt: '2025-11-04T12:00:00Z',
        },
      ],
      meta: {
        page: 1,
        perPage: 12,
        total: 2,
        totalPages: 1,
      },
    }

    render(<ClothingExplorer initialData={initialData} />)

    // Each name appears twice (placeholder and heading)
    expect(screen.getAllByText('Blue T-Shirt')).toHaveLength(2)
    expect(screen.getAllByText('Red Pants')).toHaveLength(2)
    expect(screen.getByText('Showing 2 of 2 items')).toBeInTheDocument()
  })

  it('should display category tags', () => {
    const initialData = {
      data: [
        {
          id: 1,
          name: 'Blue T-Shirt',
          category: 'TOP',
          primaryColor: 'blue',
          colors: ['blue', 'white'],
          sizes: ['M'],
          images: [],
          createdAt: '2025-11-04T12:00:00Z',
        },
      ],
      meta: {
        page: 1,
        perPage: 12,
        total: 1,
        totalPages: 1,
      },
    }

    render(<ClothingExplorer initialData={initialData} />)

    expect(screen.getByText('blue')).toBeInTheDocument()
    expect(screen.getByText('white')).toBeInTheDocument()
    expect(screen.getByText('TOP')).toBeInTheDocument()
  })

  it('should handle empty search by calling regular API', async () => {
    const user = userEvent.setup()

    // Mock for initial empty state
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        meta: { page: 1, perPage: 12, total: 0, totalPages: 1 },
      }),
    } as Response)

    // Mock for search
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 1, name: 'Item', category: 'TOP', colors: [], sizes: [], images: [], createdAt: '2025-11-04T12:00:00Z' }],
        meta: { page: 1, perPage: 12, total: 1, totalPages: 1 },
      }),
    } as Response)

    // Mock for clearing search
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        meta: { page: 1, perPage: 12, total: 0, totalPages: 1 },
      }),
    } as Response)

    render(<ClothingExplorer />)

    // Type and then clear
    const searchInput = screen.getByPlaceholderText(/Search for/i)
    await user.type(searchInput, 'test')
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    }, { timeout: 2000 })

    await user.clear(searchInput)

    // Should call regular /api/clothes endpoint
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/clothes?'),
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          })
        )
      },
      { timeout: 2000 }
    )
  })
})

