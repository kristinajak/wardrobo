"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const CATEGORY_OPTIONS = [
  { label: "All categories", value: "" },
  { label: "Tops", value: "TOP" },
  { label: "Bottoms", value: "BOTTOM" },
  { label: "Outerwear", value: "OUTERWEAR" },
  { label: "Footwear", value: "FOOTWEAR" },
  { label: "Accessories", value: "ACCESSORY" },
  { label: "Dresses", value: "DRESS" },
];

const COLOR_OPTIONS = [
  { label: "Any color", value: "" },
  { label: "Blue", value: "blue" },
  { label: "White", value: "white" },
  { label: "Khaki", value: "khaki" },
  { label: "Gray", value: "gray" },
  { label: "Brown", value: "brown" },
  { label: "Black", value: "black" },
  { label: "Olive", value: "olive" },
];

const PAGE_SIZE = 12;

type ClothingImage = {
  id: number;
  url: string;
  altText?: string | null;
  isPrimary: boolean;
};

type ClothingOwner = {
  id: number;
  name?: string | null;
  email: string;
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
  owner?: ClothingOwner | null;
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
  category: string;
  color: string;
  page: number;
};

function buildQuery(params: Filters) {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("perPage", String(PAGE_SIZE));

  if (params.search.trim()) {
    query.set("q", params.search.trim());
  }

  if (params.category) {
    query.set("category", params.category);
  }

  if (params.color) {
    query.set("color", params.color);
  }

  return query.toString();
}

export const ClothingExplorer = () => {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    category: "",
    color: "",
    page: 1,
  });

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let response: Response;
        if (useAi && filters.search.trim()) {
          response = await fetch(`/api/ai/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: filters.search,
              page: filters.page,
              perPage: PAGE_SIZE,
              category: filters.category || null,
              color: filters.color || null,
            }),
            signal: controller.signal,
          });
        } else {
          const queryString = buildQuery(filters);
          response = await fetch(`/api/clothes?${queryString}`, {
            signal: controller.signal,
          });
        }

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
  }, [filters, useAi]);

  const primaryColors = useMemo(() => {
    return items.map((item) => item.primaryColor).filter(Boolean) as string[];
  }, [items]);

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

  const handleFilterChange = (key: "category" | "color", value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
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
          Describe what you want or browse curated pieces seeded from our demo
          wardrobe.
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
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Use AI
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Search
        </button>
      </form>

      <section className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Category
          </span>
          <select
            value={filters.category}
            onChange={(event) =>
              handleFilterChange("category", event.target.value)
            }
            className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Primary color
          </span>
          <select
            value={filters.color}
            onChange={(event) =>
              handleFilterChange("color", event.target.value)
            }
            className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value || "any"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="hidden flex-col justify-center rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 sm:flex">
          <span className="font-medium">Current palette</span>
          <span className="truncate">{primaryColors.join(", ") || "-"}</span>
        </div>
      </section>

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
                  className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-3 p-4">
                    <div className="relative h-40 overflow-hidden rounded-lg bg-gray-100">
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
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-semibold text-gray-900">
                        {item.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {item.brand ?? "Independent label"}
                      </p>
                      {item.price ? (
                        <p className="text-sm font-medium text-gray-900">
                          ${Number(item.price).toFixed(2)}
                        </p>
                      ) : null}
                      <p className="text-xs uppercase tracking-wide text-gray-400">
                        {item.category}
                      </p>
                    </div>
                    {item.description ? (
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                    {item.owner
                      ? `Curated by ${item.owner.name ?? item.owner.email}`
                      : "Wardrobo collection"}
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
