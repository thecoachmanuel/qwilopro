import ApiClient from "../helpers/ApiClient";
import axios from "axios";
import { API } from "../config/config";
import { clearUserDetailsInLocalStorage } from "../helpers/UserDetails";
import useSWR from "swr";

export async function signIn(username, password) {
  axios.defaults.withCredentials = true;
  try {
    const response = await axios.post(`${API}/superadmin/signin`, {
      username,
      password,
    });

    return response;
  } catch (error) {
    throw error;
  }
}

export async function signOut() {
  axios.defaults.withCredentials = true;
  try {
    const response = await ApiClient.post(`/superadmin/signout`);

    clearUserDetailsInLocalStorage();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("restroprosaas_token");
    }

    return response;
  } catch (error) {
    throw error;
  }
}

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

export function useSuperAdminDashboard() {
  const APIURL = `/superadmin/dashboard`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useSuperAdminTenantsData() {
  const APIURL = `/superadmin/tenantsData`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export async function getSuperAdminTenantsData() {
  try {
    const APIURL = `/superadmin/tenantsData`;
    const response = await ApiClient.get(APIURL);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getTenantsData({
  page,
  perPage,
  search,
  status,
  type,
  from,
  to,
}) {
  try {
    const query = new URLSearchParams();
    if (page) query.append("page", page);
    if (perPage) query.append("perPage", perPage);
    if (search) query.append("search", search);
    if (status) query.append("status", status);
    if (type) query.append("type", type);
    if (from && from !== "null" && from !== "undefined")
      query.append("from", from);
    if (to && to !== "null" && to !== "undefined") query.append("to", to);

    const response = await ApiClient.get(
      `/superadmin/tenants?${query.toString()}`
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function addTenant(name, email, password, isActive) {
  try {
    const response = await ApiClient.post(`/superadmin/tenants/add`, {
      name,
      email,
      password,
      isActive,
    });

    return response;
  } catch (error) {
    throw error;
  }
}

export async function updateTenant(
  name,
  email,
  isActive,
  id,
  subscription_start,
  subscription_end,
  payment_gateway_product_id
) {
  try {
    const response = await ApiClient.patch(`/superadmin/tenants/update/${id}`, {
      name,
      email,
      isActive,
      subscription_start,
      subscription_end,
      payment_gateway_product_id,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteTenant(id) {
  try {
    const response = await ApiClient.delete(`/superadmin/tenants/delete/${id}`);

    return response;
  } catch (error) {
    throw error;
  }
}

export async function getTenantsDataByStatus(status) {
  try {
    const response = await ApiClient.get(`/superadmin/tenantsData/${status}`);

    return response;
  } catch (error) {
    throw error;
  }
}

export function useSuperAdminReports({ type, from = null, to = null }) {
  const query = new URLSearchParams();
  if (type) query.append("type", type);
  if (from && from !== "null" && from !== "undefined")
    query.append("from", from);
  if (to && to !== "null" && to !== "undefined") query.append("to", to);

  const APIURL = `/superadmin/reports?${query.toString()}`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

export function useSuperAdminTenantSubscriptionHistory(tenantId) {
  const APIURL = `/superadmin/tenants/${tenantId}/subscription-history`;
  const { data, error, isLoading } = useSWR(APIURL, fetcher);
  return {
    data,
    error,
    isLoading,
    APIURL,
  };
}

// Payment Gateway Functions
export async function getPaymentGateways() {
  try {
    const response = await ApiClient.get(`/superadmin/payment-gateways`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getPaymentGatewayById(id) {
  try {
    const response = await ApiClient.get(`/superadmin/payment-gateways/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updatePaymentGatewayStatus(gatewayName, isEnabled) {
  try {
    const response = await ApiClient.put(`/superadmin/payment-gateway/status`, {
      name: gatewayName,
      status: isEnabled,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function activatePaymentGateway() {
  try {
    const response = await ApiClient.get(
      `/superadmin/payment-gateway/activate`
    );
    return response;
  } catch (error) {
    throw error;
  }
}

export async function updatePaymentGatewayCredentials(gatewayName, credentials) {
  try {
    const response = await ApiClient.put(
      `/superadmin/payment-gateway/credentials`,
      {
        gateway_name: gatewayName,
        credentials: credentials,
      }
    );
    return response;
  } catch (error) {
    throw error;
  }
}