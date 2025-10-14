"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

const PAGE_SIZE = 12;

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

export const ClothingExplorer = () => {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    page: 1,
  });

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AI is used when a prompt is provided; empty prompt loads all items
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setIsLoading(true);
      setError(null);

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
          setItems(payload.data);
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
        setItems(payload.data);
        setTotalPages(payload.meta.totalPages);
        setTotal(payload.meta.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [filters]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchValue = String(formData.get("search") ?? "");

    setFilters((current) => ({
      ...current,
      search: searchValue,
      page: 1,
    }));
  };

  const goToPage = (page: number) => {
    setFilters((current) => ({
      ...current,
      page,
    }));
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Wardrobo</h1>
        <p className="text-base text-gray-600">
          Search in natural language (e.g. &ldquo;red striped t-shirt&quot; or
          &ldquo;black jeans with white flowers&quot;). <br></br>Upload your own
          photos and AI will auto‑tag colors, patterns, and type.
        </p>
      </header>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-4 rounded-lg border border-gray-200/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Search wardrobe
          </label>
          <input
            id="search"
            name="search"
            defaultValue={filters.search}
            placeholder='Search for "blue short sleeve tee"'
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-inner focus:border-gray-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Search
        </button>
      </form>

      <section className="rounded-lg border border-gray-200/60 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">
          Upload new item
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const data = new FormData(form);
            setIsUploading(true);
            setError(null);
            try {
              const resp = await fetch("/api/upload", {
                method: "POST",
                body: data,
              });
              if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Upload failed: ${resp.status} ${text}`);
              }
              // refresh list
              setFilters((current) => ({ ...current }));
              form.reset();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setIsUploading(false);
            }
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Name
            </span>
            <input
              name="name"
              placeholder="Item name"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Image file
            </span>
            <input
              name="file"
              type="file"
              accept="image/*"
              required
              className="text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isUploading}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isUploading ? "Uploading..." : "Upload item"}
            </button>
          </div>
        </form>
      </section>
      {/* Removed manual filters; AI-only search */}

      <section>
        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-sm text-gray-500">
            Loading wardrobe suggestions...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center text-sm text-gray-500">
            No items match your filters yet. Try adjusting your search.
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const primaryImage =
                item.images.find((img) => img.isPrimary) ?? item.images[0];
              const imageSrc = primaryImage?.url ?? item.imageUrl ?? "";
              const imageAlt = primaryImage?.altText ?? item.name;

              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-2 p-3">
                    <div className="relative h-48 overflow-hidden rounded-lg bg-gray-100">
                      {imageSrc ? (
                        <Image
                          src={imageSrc}
                          alt={imageAlt}
                          fill
                          sizes="(min-width: 1024px) 240px, (min-width: 768px) 33vw, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-400">
                          {item.name}
                        </div>
                      )}
                    </div>
                    <h2 className="truncate text-sm font-medium text-gray-900">
                      {item.name}
                    </h2>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="flex flex-col items-center gap-2 border-t border-gray-200 pt-6 text-sm text-gray-600 sm:flex-row sm:justify-between">
        <span>
          Showing {items.length} of {total} items
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={filters.page <= 1 || isLoading}
            onClick={() => goToPage(Math.max(1, filters.page - 1))}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {filters.page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={filters.page >= totalPages || isLoading}
            onClick={() => goToPage(Math.min(totalPages, filters.page + 1))}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ClothingExplorer;
