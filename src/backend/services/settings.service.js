const crypto = require("crypto");
const { CONFIG } = require("../config");
const {
  StoreDetails,
  StoreTable,
  Tax,
  PaymentType,
  Category,
  PrintSetting,
  QROrder,
  QROrderItem,
  Customer,
  Feedback,
} = require("../models");

const encryptTableId = (id) => {
  try {
    const key = crypto.createHash("sha256").update(CONFIG.ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(String(id), "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + encrypted;
  } catch {
    return String(id);
  }
};

const decryptTableId = (encryptedId) => {
  if (!encryptedId) return null;
  if (!isNaN(encryptedId)) return Number(encryptedId);
  try {
    const key = crypto.createHash("sha256").update(CONFIG.ENCRYPTION_KEY).digest();
    const iv = Buffer.from(encryptedId.slice(0, 32), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedId.slice(32), "hex", "utf8");
    decrypted += decipher.final("utf8");
    return Number(decrypted);
  } catch {
    return Number(encryptedId) || null;
  }
};

exports.getTenantIdFromQRCode = async (qrcode) => {
  try {
    if (!qrcode) return null;
    const cleanCode = String(qrcode).trim().toLowerCase();
    const isNum = !isNaN(cleanCode) && cleanCode !== "";
    const numericId = isNum ? parseInt(cleanCode, 10) : -999999;

    let store = await StoreDetails.findOne({
      $or: [
        ...(isNum ? [{ tenant_id: numericId }] : []),
        { unique_qr_code: qrcode },
        { slug: cleanCode },
        { slug: qrcode },
        { custom_domain: cleanCode },
      ],
    }).select("tenant_id slug unique_qr_code custom_domain").lean();

    if (!store) {
      const slugified = cleanCode.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const withoutThe = cleanCode.replace(/^the-/, "");
      const withThe = `the-${cleanCode}`;
      const namePattern = cleanCode.replace(/[-_]+/g, "\\s*");

      store = await StoreDetails.findOne({
        $or: [
          { slug: slugified },
          { slug: withoutThe },
          { slug: withThe },
          { custom_domain: slugified },
          { custom_domain: withoutThe },
          { store_name: new RegExp(`^${qrcode}$`, "i") },
          { store_name: new RegExp(`^(the\\s+)?${namePattern}$`, "i") },
          { store_name: new RegExp(namePattern, "i") },
        ],
      }).select("tenant_id slug unique_qr_code custom_domain").lean();
    }

    if (!store) {
      // Resilient fallback: check all stores if slugified store_name matches cleanCode or prefix
      const allStores = await StoreDetails.find({}).select("tenant_id store_name slug unique_qr_code").lean();
      for (const s of allStores) {
        if (!s.store_name) continue;
        const sSlug = s.slug ? s.slug.toLowerCase() : "";
        const sNameSlug = s.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const sNameNoThe = sNameSlug.replace(/^the-/, "");

        if (
          cleanCode === sNameSlug ||
          cleanCode === sNameNoThe ||
          (sSlug && cleanCode.startsWith(sSlug)) ||
          (sSlug && sSlug.startsWith(cleanCode))
        ) {
          store = s;
          break;
        }
      }
    }

    return store?.tenant_id || null;
  } catch (error) {
    console.error("getTenantIdFromQRCode Error:", error);
    throw error;
  }
};

exports.getCurrencyDB = async (tenantId) => {
  try {
    const store = await StoreDetails.findOne({ tenant_id: tenantId }).select("currency").lean();
    return store?.currency || "NGN";
  } catch (error) {
    console.error("getCurrencyDB Error:", error);
    throw error;
  }
};

exports.getStoreSettingDB = async (tenantId) => {
  try {
    return await StoreDetails.findOne({ tenant_id: tenantId }).lean();
  } catch (error) {
    console.error("getStoreSettingDB Error:", error);
    throw error;
  }
};

exports.setStoreSettingDB = async (
  storeName,
  address,
  phone,
  email,
  currency,
  isQRMenuEnabled,
  isQROrderEnabled,
  uniqueQRCode,
  isFeedbackEnabled,
  tenantId,
  slug = null,
  custom_domain = null,
  isDeliveryEnabled = 0,
  deliveryFee = 0
) => {
  try {
    const updateDoc = {
      store_name: storeName,
      address,
      phone,
      email,
      currency,
      is_qr_menu_enabled: isQRMenuEnabled ? 1 : 0,
      is_qr_order_enabled: isQROrderEnabled ? 1 : 0,
      unique_qr_code: uniqueQRCode,
      is_feedback_enabled: isFeedbackEnabled ? 1 : 0,
      is_delivery_enabled: isDeliveryEnabled ? 1 : 0,
      delivery_fee: Number(deliveryFee) || 0,
    };
    if (slug) {
      updateDoc.slug = slug;
    }
    if (custom_domain !== undefined) {
      updateDoc.custom_domain = custom_domain;
    }
    await StoreDetails.findOneAndUpdate(
      { tenant_id: tenantId },
      { $set: updateDoc },
      { upsert: true, new: true }
    );
    if (custom_domain !== undefined) {
      const { Tenant } = require("../models");
      await Tenant.findOneAndUpdate(
        { id: tenantId },
        { $set: { custom_domain } }
      ).catch(() => {});
    }
  } catch (error) {
    console.error("setStoreSettingDB Error:", error);
    throw error;
  }
};

exports.uploadStoreImageDB = async (image, uniqueId, tenantId) => {
  try {
    await StoreDetails.findOneAndUpdate(
      { tenant_id: tenantId },
      {
        $set: {
          store_image: image,
          unique_id: uniqueId,
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("uploadStoreImageDB Error:", error);
    throw error;
  }
};

exports.deleteStoreImageDB = async (image, uniqueId, tenantId) => {
  try {
    await StoreDetails.updateOne(
      { tenant_id: tenantId },
      { $set: { store_image: null, unique_id: null } }
    );
  } catch (error) {
    console.error("deleteStoreImageDB Error:", error);
    throw error;
  }
};

exports.updateServiceChargeDB = async (serviceCharge, tenantId) => {
  try {
    await StoreDetails.findOneAndUpdate(
      { tenant_id: tenantId },
      { $set: { service_charge: Number(serviceCharge || 0) } },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("updateServiceChargeDB Error:", error);
    throw error;
  }
};

exports.getServiceChargeDB = async (tenantId) => {
  try {
    const store = await StoreDetails.findOne({ tenant_id: tenantId }).select("service_charge").lean();
    return store?.service_charge ?? 0;
  } catch (error) {
    console.error("getServiceChargeDB Error:", error);
    throw error;
  }
};

exports.getQRMenuCodeDB = async (tenantId) => {
  try {
    const store = await StoreDetails.findOne({ tenant_id: tenantId }).select("unique_qr_code").lean();
    return store?.unique_qr_code || null;
  } catch (error) {
    console.error("getQRMenuCodeDB Error:", error);
    throw error;
  }
};

exports.updateQRMenuCodeDB = async (uniqueQRCode, tenantId) => {
  try {
    await StoreDetails.updateOne({ tenant_id: tenantId }, { $set: { unique_qr_code: uniqueQRCode } });
  } catch (error) {
    console.error("updateQRMenuCodeDB Error:", error);
    throw error;
  }
};

exports.getPrintSettingDB = async (tenantId) => {
  try {
    return await PrintSetting.findOne({ tenant_id: tenantId }).lean();
  } catch (error) {
    console.error("getPrintSettingDB Error:", error);
    throw error;
  }
};

exports.setPrintSettingDB = async (
  pageFormat,
  header,
  footer,
  showNotes,
  isEnablePrint,
  showStoreDetails,
  showCustomerDetails,
  printToken,
  tenantId
) => {
  try {
    await PrintSetting.findOneAndUpdate(
      { tenant_id: tenantId },
      {
        $set: {
          page_format: pageFormat,
          header,
          footer,
          show_notes: !!showNotes,
          is_enable_print: !!isEnablePrint,
          show_store_details: !!showStoreDetails,
          show_customer_details: !!showCustomerDetails,
          print_token: !!printToken,
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("setPrintSettingDB Error:", error);
    throw error;
  }
};

exports.addTaxDB = async (title, rate, type, tenantId) => {
  try {
    const tax = await Tax.create({
      title,
      rate,
      type,
      tenant_id: tenantId,
    });
    return tax.id;
  } catch (error) {
    console.error("addTaxDB Error:", error);
    throw error;
  }
};

exports.getTaxesDB = async (tenantId) => {
  try {
    return await Tax.find({ tenant_id: tenantId }).select("id title rate type").lean();
  } catch (error) {
    console.error("getTaxesDB Error:", error);
    throw error;
  }
};

exports.getTaxDB = async (taxId, tenantId) => {
  try {
    return await Tax.findOne({ id: taxId, tenant_id: tenantId }).select("id title rate type").lean();
  } catch (error) {
    console.error("getTaxDB Error:", error);
    throw error;
  }
};

exports.deleteTaxDB = async (id, tenantId) => {
  try {
    await Tax.deleteOne({ id, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteTaxDB Error:", error);
    throw error;
  }
};

exports.updateTaxDB = async (id, title, rate, type, tenantId) => {
  try {
    await Tax.updateOne(
      { id, tenant_id: tenantId },
      { $set: { title, rate, type } }
    );
  } catch (error) {
    console.error("updateTaxDB Error:", error);
    throw error;
  }
};

exports.addPaymentTypeDB = async (title, isActive, tenantId, icon) => {
  try {
    const pt = await PaymentType.create({
      title,
      is_active: !!isActive,
      tenant_id: tenantId,
      icon,
    });
    return pt.id;
  } catch (error) {
    console.error("addPaymentTypeDB Error:", error);
    throw error;
  }
};

exports.getPaymentTypesDB = async (activeOnly = false, tenantId) => {
  try {
    const query = { tenant_id: tenantId };
    if (activeOnly) {
      query.is_active = true;
    }
    let types = await PaymentType.find(query).select("id title is_active icon").lean();

    if (!types || types.length === 0) {
      const anyExist = await PaymentType.countDocuments({ tenant_id: tenantId });
      if (anyExist === 0) {
        const defaultTypes = [
          { tenant_id: tenantId, id: 1, title: "Cash", is_active: true, icon: "cash" },
          { tenant_id: tenantId, id: 2, title: "Debit / Credit Card", is_active: true, icon: "card" },
          { tenant_id: tenantId, id: 3, title: "Bank Transfer", is_active: true, icon: "bank" },
        ];
        await PaymentType.insertMany(defaultTypes).catch(() => {});
        types = await PaymentType.find(query).select("id title is_active icon").lean();
      }
    }

    return types || [];
  } catch (error) {
    console.error("getPaymentTypesDB Error:", error);
    throw error;
  }
};

exports.updatePaymentTypeDB = async (id, title, isActive, tenantId, icon) => {
  try {
    await PaymentType.updateOne(
      { id, tenant_id: tenantId },
      { $set: { title, is_active: !!isActive, icon } }
    );
  } catch (error) {
    console.error("updatePaymentTypeDB Error:", error);
    throw error;
  }
};

exports.togglePaymentTypeDB = async (id, isActive, tenantId) => {
  try {
    await PaymentType.updateOne(
      { id, tenant_id: tenantId },
      { $set: { is_active: !!isActive } }
    );
  } catch (error) {
    console.error("togglePaymentTypeDB Error:", error);
    throw error;
  }
};

exports.deletePaymentTypeDB = async (id, tenantId) => {
  try {
    await PaymentType.deleteOne({ id, tenant_id: tenantId });
  } catch (error) {
    console.error("deletePaymentTypeDB Error:", error);
    throw error;
  }
};

exports.addStoreTableDB = async (title, floor, seatingCapacity, tenantId) => {
  try {
    const table = await StoreTable.create({
      table_title: title,
      floor,
      seating_capacity: seatingCapacity,
      tenant_id: tenantId,
    });
    return table.id;
  } catch (error) {
    console.error("addStoreTableDB Error:", error);
    throw error;
  }
};

exports.getStoreTablesDB = async (tenantId) => {
  try {
    const tables = await StoreTable.find({ tenant_id: tenantId })
      .select("id table_title floor seating_capacity")
      .lean();

    return tables.map((t) => ({
      ...t,
      encrypted_id: encryptTableId(t.id),
    }));
  } catch (error) {
    console.error("getStoreTablesDB Error:", error);
    throw error;
  }
};

exports.getStoreTableByEncryptedIdDB = async (tenantId, encryptedTableId) => {
  try {
    const tableId = decryptTableId(encryptedTableId);
    if (!tableId) return null;

    return await StoreTable.findOne({
      tenant_id: tenantId,
      id: tableId,
    }).select("id table_title floor seating_capacity").lean();
  } catch (error) {
    console.error("getStoreTableByEncryptedIdDB Error:", error);
    throw error;
  }
};

exports.updateStoreTableDB = async (id, title, floor, seatingCapacity, tenantId) => {
  try {
    await StoreTable.updateOne(
      { id, tenant_id: tenantId },
      { $set: { table_title: title, floor, seating_capacity: seatingCapacity } }
    );
  } catch (error) {
    console.error("updateStoreTableDB Error:", error);
    throw error;
  }
};

exports.deleteStoreTableDB = async (id, tenantId) => {
  try {
    await StoreTable.deleteOne({ id, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteStoreTableDB Error:", error);
    throw error;
  }
};

exports.addCategoryDB = async (title, tenantId) => {
  try {
    const cat = await Category.create({
      title,
      tenant_id: tenantId,
      is_enabled: true,
    });
    return cat.id;
  } catch (error) {
    console.error("addCategoryDB Error:", error);
    throw error;
  }
};

exports.getCategoriesDB = async (tenantId) => {
  try {
    return await Category.find({ tenant_id: tenantId }).select("id title is_enabled").lean();
  } catch (error) {
    console.error("getCategoriesDB Error:", error);
    throw error;
  }
};

exports.updateCategoryDB = async (id, title, tenantId) => {
  try {
    await Category.updateOne({ id, tenant_id: tenantId }, { $set: { title } });
  } catch (error) {
    console.error("updateCategoryDB Error:", error);
    throw error;
  }
};

exports.deleteCategoryDB = async (id, tenantId) => {
  try {
    await Category.deleteOne({ id, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteCategoryDB Error:", error);
    throw error;
  }
};

exports.changeCategoryVisibiltyDB = async (id, isEnabled, tenantId) => {
  try {
    await Category.updateOne({ id, tenant_id: tenantId }, { $set: { is_enabled: !!isEnabled } });
  } catch (error) {
    console.error("changeCategoryVisibiltyDB Error:", error);
    throw error;
  }
};

exports.placeOrderViaQrMenuDB = async (
  tenantId,
  deliveryType,
  cartItems,
  customerType,
  customerId,
  tableId,
  customerName,
  paymentStatus = "pending",
  deliveryFee = 0
) => {
  try {
    const validTableId = (tableId && !isNaN(Number(tableId))) ? Number(tableId) : null;

    const order = await QROrder.create({
      delivery_type: deliveryType,
      customer_type: customerType,
      customer_id: customerId,
      customer_name: customerName || null,
      table_id: validTableId,
      delivery_fee: Number(deliveryFee) || 0,
      payment_status: paymentStatus || "pending",
      tenant_id: tenantId,
    });


    const orderId = order.id;

    if (cartItems && cartItems.length > 0) {
      const itemsToInsert = cartItems.map((item) => ({
        order_id: orderId,
        item_id: Number(item.id || item.item_id),
        variant_id: item.variant_id ? Number(item.variant_id) : null,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        notes: item.notes || "",
        addons: item?.addons_ids?.length > 0 ? JSON.stringify(item.addons_ids) : null,
        tenant_id: tenantId,
      }));
      await QROrderItem.insertMany(itemsToInsert);
    }

    if (customerId) {
      const existing = await Customer.findOne({ phone: customerId, tenant_id: tenantId });
      if (!existing) {
        await Customer.create({
          phone: customerId,
          name: customerName || "Guest",
          tenant_id: tenantId,
        });
      }
    }

    let encryptedInvoiceId = null;
    try {
      const { encryptInvoiceId } = require("./orders.service");
      encryptedInvoiceId = encryptInvoiceId ? encryptInvoiceId(orderId) : String(orderId);
    } catch {
      encryptedInvoiceId = String(orderId);
    }

    return { orderId, invoiceId: encryptedInvoiceId };
  } catch (error) {
    console.error("placeOrderViaQrMenuDB Error:", error);
    throw error;
  }
};


exports.saveFeedbackDB = async (

  tenantId,
  invoiceId,
  customerId,
  phone,
  name,
  email,
  birthdate,
  averageRating,
  food_quality,
  service,
  ambiance,
  staff_behavior,
  recommend,
  remarks
) => {
  try {
    const customerPhone = customerId || phone;
    if (customerPhone) {
      const existingCustomer = await Customer.findOne({ phone: customerPhone, tenant_id: tenantId });
      if (!existingCustomer) {
        await Customer.create({
          phone: customerPhone,
          name: name || "Customer",
          email: email || null,
          birth_date: birthdate || null,
          tenant_id: tenantId,
        });
      }
    }

    await Feedback.create({
      invoice_id: invoiceId,
      phone: customerPhone || null,
      created_by: null,
      average_rating: averageRating,
      food_quality_rating: food_quality,
      service_rating: service,
      staff_behavior_rating: staff_behavior,
      ambiance_rating: ambiance,
      recommend_rating: recommend,
      remarks: remarks || null,
      tenant_id: tenantId,
    });
  } catch (error) {
    console.error("saveFeedbackDB Error:", error);
    throw error;
  }
};
