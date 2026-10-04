import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useDashboard() {
  const APIURL = `/dashboard`;
  const { data, error, isLoading, mutate } = useSWR(APIURL, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    revalidateIfStale: false,
  });
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL,
  };
}