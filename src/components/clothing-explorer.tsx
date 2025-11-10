"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState, useRef, useCallback } from "react";

const PAGE_SIZE = 12;

const EXAMPLE_QUERIES = [
  "red striped t-shirt",
  "sweatshirt with snake",
  "blue short sleeve t-shirt",
  "flower pattern",
  "patterned sweater",
];

type ClothingImage = {
  id: number;
  url: string;
  altText?: string | null;
  isPrimary: boolean;
};

type ClothingItem = {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  price?: string | null;
  primaryColor?: string | null;
  imageUrl?: string | null;
  brand?: string | null;
  createdAt: string;
  colors: string[];
  sizes: string[];
  images: ClothingImage[];
};

type ApiResponse = {
  data: ClothingItem[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
};

type Filters = {
  search: string;
  page: number;
};

type ClothingExplorerProps = {
  initialData?: ApiResponse;
};

export const ClothingExplorer = ({ initialData }: ClothingExplorerProps) => {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    page: 1,
  });

  const [items, setItems] = useState<ClothingItem[]>(initialData?.data ?? []);
  const [totalPages, setTotalPages] = useState(
    initialData?.meta.totalPages ?? 1
  );
  const [total, setTotal] = useState(initialData?.meta.total ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasInitialData, setHasInitialData] = useState(!!initialData);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Local input value for immediate UI updates
  const [searchInput, setSearchInput] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setFilters((current) => ({
        ...current,
        search: searchInput,
        page: 1,
      }));
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

  // Listen for upload success events from the Header component
  useEffect(() => {
    const handleUploadSuccess = () => {
      setSearchInput("");
      setFilters({ search: "", page: 1 });
      setRefreshTrigger((prev) => prev + 1);
    };

    window.addEventListener("wardrobo:upload-success", handleUploadSuccess);
    return () => {
      window.removeEventListener(
        "wardrobo:upload-success",
        handleUploadSuccess
      );
    };
  }, []);

  useEffect(() => {
    // Skip fetch if we're showing initial server-rendered data
    if (
      hasInitialData &&
      filters.page === 1 &&
      !filters.search &&
      refreshTrigger === 0
    ) {
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      const loadingStartTime = Date.now();
      if (filters.page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);
      setHasInitialData(false);

      try {
        if (!filters.search.trim()) {
          const qs = new URLSearchParams({
            page: String(filters.page),
            perPage: String(PAGE_SIZE),
          });
          const response = await fetch(`/api/clothes?${qs.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          const payload: ApiResponse = await response.json();
          if (filters.page > 1) {
            setItems((prev) => [...prev, ...payload.data]);
          } else {
            setItems(payload.data);
          }
          setTotalPages(payload.meta.totalPages);
          setTotal(payload.meta.total);
          return;
        }

        const response = await fetch(`/api/ai/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: filters.search,
            page: filters.page,
            perPage: PAGE_SIZE,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload: ApiResponse = await response.json();
        if (filters.page > 1) {
          setItems((prev) => [...prev, ...payload.data]);
        } else {
          setItems(payload.data);
        }
        setTotalPages(payload.meta.totalPages);
        setTotal(payload.meta.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError((err as Error).message);
      } finally {
        // Show spinner for at least 500ms for better UX
        const elapsedTime = Date.now() - loadingStartTime;
        const minDisplayTime = 500;
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime);
        if (remainingTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    };

    run();

    return () => controller.abort();
  }, [filters, refreshTrigger, hasInitialData]);

  // Load more when scrolling to bottom
  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || filters.page >= totalPages) {
      return;
    }
    setFilters((current) => ({
      ...current,
      page: current.page + 1,
    }));
  }, [isLoading, isLoadingMore, filters.page, totalPages]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [loadMore]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      search: searchInput,
      page: 1,
    }));
  };

  const handleClearSearch = () => {
    setSearchInput("");
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-6">
        <p className="text-base text-gray-700">
          Search in natural language (e.g. &ldquo;red striped t-shirt&rdquo; or
          &ldquo;sweatshirt with snake&rdquo;). Upload your own photos and AI
          will auto-tag colors, patterns, and type.
        </p>

        <form onSubmit={handleSearchSubmit} className="w-full">
          <label htmlFor="search" className="sr-only">
            Search wardrobe
          </label>
          <div className="relative">
            <MagnifyingGlassIcon />
            <input
              id="search"
              name="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder='Search for "blue short sleeve tee"'
              className="h-14 w-full rounded-lg border border-gray-ddd bg-white pl-12 pr-12 text-base outline-none transition focus:border-gray-aaa"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                aria-label="Clear search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* Example Questions */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setSearchInput(example)}
              className="rounded-full bg-p1 text-white px-4 py-1 text-sm transition hover:bg-p2"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <section>
        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="px-4 py-3 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center text-gray-666">
            No items match your filters yet. Try adjusting your search.
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const primaryImage =
                item.images.find((img) => img.isPrimary) ?? item.images[0];
              const imageSrc = primaryImage?.url ?? item.imageUrl ?? "";
              const imageAlt = primaryImage?.altText ?? item.name;
              const tagChips = [
                ...(Array.isArray(item.colors) ? item.colors : []),
                item.category,
              ].filter(Boolean) as string[];

              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-2 p-3">
                    <div className="relative w-full overflow-hidden rounded-xl bg-gray-100 aspect-[4/5] max-h-64">
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={imageAlt}
                          fill
                          sizes="(min-width: 1024px) 240px, (min-width: 768px) 33vw, 100vw"
                          className="object-contain object-center p-2"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">
                          {item.name}
                        </div>
                      )}
                    </div>
                    <h2 className="truncate font-medium text-gray-900">
                      {item.name}
                    </h2>
                    {tagChips.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {tagChips.map((chip, idx) => (
                          <span
                            key={`${chip}-${idx}`}
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {/* Infinite scroll trigger */}
        {!isLoading && items.length > 0 && items.length < total && (
          <div ref={observerTarget} className="flex justify-center py-8">
            {isLoadingMore && <LoadingSpinner />}
          </div>
        )}
      </section>

      {items.length > 0 && (
        <footer className="flex justify-center border-t border-gray-200 pt-6 text-sm text-gray-600">
          <span>
            Showing {items.length} of {total} items
          </span>
        </footer>
      )}
    </div>
  );
};

const MagnifyingGlassIcon = () => (
  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-666">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M10.5 3.75a6.75 6.75 0 1 0 4.243 11.964l3.771 3.772a.75.75 0 1 0 1.06-1.06l-3.772-3.772A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z"
        clipRule="evenodd"
      />
    </svg>
  </span>
);

const LoadingSpinner = () => (
  <svg
    className="h-8 w-8 animate-spin text-p1"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default ClothingExplorer;
