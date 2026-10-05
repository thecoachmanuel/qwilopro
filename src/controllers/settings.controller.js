import ApiClient from "../helpers/ApiClient";
import useSWR from "swr";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";

const fetcher = (url) => ApiClient.get(url).then((res) => res.data);

// Returns the current tenant's ID to namespace all SWR cache keys.
// This prevents cross-tenant data bleed when multiple tenants use the same browser.
function useTenantId() {
  const user = getUserDetailsInLocalStorage();
  return user?.tenant_id ?? "guest";
}

export function useStoreSettings() {
  const tenantId = useTenantId();
  // Key includes tenantId → each tenant has an isolated SWR cache bucket
  const APIURL = `/settings/store-setting`;
  const cacheKey = `${APIURL}?t=${tenantId}`;
  const { data, error, isLoading, mutate } = useSWR(cacheKey, () => fetcher(APIURL));
  return {
    data,
    error,
    isLoading,
    mutate,
    APIURL: cacheKey, // used by callers to invalidate via mutate(APIURL)
  };
}

export async function saveStoreSettings(
  storeName,
  address,
  phone,
  email,
  currency,
  image,
  isQRMenuEnabled,
  isQROrderEnabled,
  isFeedbackEnabled,
  slug = null,
  custom_domain = null,
  isDeliveryEnabled = false,
  deliveryFee = 0
) {
  try {
    const response = await ApiClient.post("/settings/store-setting", {
      storeName,
      address,
      phone,
      email,
      currency,
      image,
      isQRMenuEnabled,
      isQROrderEnabled,
      isFeedbackEnabled,
      slug,
      custom_domain,
      isDeliveryEnabled: isDeliveryEnabled ? 1 : 0,
      deliveryFee: Number(deliveryFee) || 0,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function uploadStoreImage(formData) {
  try {
    const response = await ApiClient.post("/settings/store-setting/upload-store-image", formData);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteStoreImage(uniqueId) {
  try {
    const response = await ApiClient.post("/settings/store-setting/delete-store-image", {
      uniqueId
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getServiceCharge() {
  try {
    const response = await ApiClient.get(`/settings/store-setting/service-charge`)
    return response;
  } catch (error) {
    throw error;
  }
}


export async function updateServiceCharge(serviceCharge) {
  try {
    const response = await ApiClient.post(`/settings/store-setting/service-charge`, {
      serviceCharge
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function usePrintSettings() {
  const tenantId = useTenantId();
  const APIURL = `/settings/print-setting`;
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

export async function savePrintSettings(pageFormat, header, footer, showNotes, isEnablePrint, showStoreDetails, showCustomerDetails, printToken) {
  try {
    const response = await ApiClient.post("/settings/print-setting", {
      pageFormat, header, footer, showNotes, isEnablePrint, showStoreDetails, printToken, showCustomerDetails
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export function usePaymentTypes() {
  const tenantId = useTenantId();
  const APIURL = `/settings/payment-types`;
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

export async function addNewPaymentType(title, isActive, icon) {
  try {
    const response = await ApiClient.post("/settings/payment-types/add", {
      title,
      isActive,
      icon
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function deletePaymentType(id) {
  try {
    const response = await ApiClient.delete(`/settings/payment-types/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function togglePaymentType(id, isActive) {
  try {
    const response = await ApiClient.post(`/settings/payment-types/${id}/toggle`, {
      isActive
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updatePaymentType(id, title, isActive, icon) {
  try {
    const response = await ApiClient.post(`/settings/payment-types/${id}/update`, {
      title,
      isActive,
      icon
    })
    return response;
  } catch (error) {
    throw error;
  }
};


export function useTaxes() {
  const tenantId = useTenantId();
  const APIURL = `/settings/taxes`;
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

export async function addNewTax(title, rate, type) {
  try {
    const response = await ApiClient.post("/settings/taxes/add", {
      title,
      rate, type
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function deleteTax(id) {
  try {
    const response = await ApiClient.delete(`/settings/taxes/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateTax(id, title, rate, type) {
  try {
    const response = await ApiClient.post(`/settings/taxes/${id}/update`, {
      title,
      rate, type
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function useStoreTables() {
  const tenantId = useTenantId();
  const APIURL = `/settings/store-tables`;
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

export async function deleteTable(id) {
  try {
    const response = await ApiClient.delete(`/settings/store-tables/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function addNewStoreTable(title, floor, seatingCapacity) {
  try {
    const response = await ApiClient.post("/settings/store-tables/add", {
      title, floor, seatingCapacity
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateStoreTable(id, title, floor, seatingCapacity) {
  try {
    const response = await ApiClient.post(`/settings/store-tables/${id}/update`, {
      title, floor, seatingCapacity
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function useCategories() {
  const tenantId = useTenantId();
  const APIURL = `/settings/categories`;
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

export async function addCategory(title) {
  try {
    const response = await ApiClient.post("/settings/categories/add", {
      title
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function deleteCategory(id) {
  try {
    const response = await ApiClient.delete(`/settings/categories/${id}`)
    return response;
  } catch (error) {
    throw error;
  }
};

export async function updateCategory(id, title) {
  try {
    const response = await ApiClient.post(`/settings/categories/${id}/update`, {
      title
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export async function changeCategoryVisibilty(id, isEnabled) {
  try {
    const response = await ApiClient.patch(`/settings/categories/change-visibility/${id}`, {
      isEnabled
    })
    return response;
  } catch (error) {
    throw error;
  }
};

export function useDevices() {
  const tenantId = useTenantId();
  const APIURL = `/auth/devices`;
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

export async function removeDevice(deviceId) {
  try {
    const response = await ApiClient.post(`/auth/remove-device`, {
      device_id: deviceId
    })
    return response;
  } catch (error) {
    throw error;
  }
};



