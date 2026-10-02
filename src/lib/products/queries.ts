import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { repo, type ListParams } from "./repository";
import { RepoError } from "./errors";

export const productKeys = {
  all: ["products"] as const,
  list: (p: Omit<ListParams, "cursor">) => ["products", "list", p] as const,
  detail: (id: string) => ["products", "detail", id] as const,
};

export const productListQuery = (p: Omit<ListParams, "cursor">) =>
  infiniteQueryOptions({
    queryKey: productKeys.list(p),
    queryFn: ({ pageParam }) => repo.list({ ...p, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: (prev) => prev,
    retry: (n, e) => !(e instanceof RepoError && e.code !== "unknown") && n < 2,
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => repo.get(id),
    retry: (n, e) => !(e instanceof RepoError && e.code !== "unknown") && n < 2,
    staleTime: 0,
  });
