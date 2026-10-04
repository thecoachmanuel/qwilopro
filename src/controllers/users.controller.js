import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";

import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

function useTenantId() {
  const user = getUserDetailsInLocalStorage();
  return user?.tenant_id ?? "guest";
}

export function useUsers() {
  const tenantId = useTenantId();
  const APIURL = `/users`;
  const cacheKey = `${APIURL}?t=${tenantId}`;
  const { data, error, isLoading, mutate } = useSWR(cacheKey, () => fetcher(APIURL));
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL: cacheKey,
  };
}
  

export async function addNewUser(
  username,
  password,
  name,
  designation,
  phone,
  email,
  userScopes
) {
  try {
    const response = await ApiClient.post("/users/add", {
      username,
      password,
      name,
      designation,
      phone,
      email,
      userScopes,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteUser(username) {
  try {
    const response = await ApiClient.delete(`/users/delete/${username}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function resetUserPassword(username, password) {
  try {
    const response = await ApiClient.post(`/users/update-password/${username}`, {
      password
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateUser(
  username,
  name,
  designation,
  phone,
  email,
  userScopes
) {
  try {
    const response = await ApiClient.post(`/users/update/${username}`, {
      name,
      designation,
      phone,
      email,
      userScopes,
    });
    return response;
  } catch (error) {
    throw error;
  }
}
