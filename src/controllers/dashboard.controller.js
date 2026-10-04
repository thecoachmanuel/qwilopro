import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useDashboard() {
  const APIURL = `/dashboard`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher, {
    // Revalidate whenever tab is refocused (catches plan upgrades, new data)
    revalidateOnFocus: true,
    // Revalidate when browser reconnects from offline
    revalidateOnReconnect: true,
    // Allow background refresh of stale data (critical for Vercel cold-start recovery)
    revalidateIfStale: true,
    // Deduplicate identical requests within 30s to prevent hammering
    dedupingInterval: 30000,
    // Auto-retry on error: exponential backoff up to 3 attempts
    onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
      // Don't retry on subscription errors (402/403)
      if (err?.response?.status === 402 || err?.response?.status === 403) return;
      // Max 3 retries
      if (retryCount >= 3) return;
      // Exponential backoff: 2s, 4s, 8s
      setTimeout(() => revalidate({ retryCount }), 2000 * Math.pow(2, retryCount));
    },
  });
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}