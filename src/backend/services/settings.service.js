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
    const store = await StoreDetails.findOne({ unique_qr_code: qrcode }).select("tenant_id").lean();
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
  tenantId
) => {
  try {
    await StoreDetails.findOneAndUpdate(
      { tenant_id: tenantId },
      {
        $set: {
          store_name: storeName,
          address,
          phone,
          email,
          currency,
          is_qr_menu_enabled: isQRMenuEnabled ? 1 : 0,
          is_qr_order_enabled: isQROrderEnabled ? 1 : 0,
          unique_qr_code: uniqueQRCode,
          is_feedback_enabled: isFeedbackEnabled ? 1 : 0,
        },
      },
      { upsert: true, new: true }
    );
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
      { tenant_id: tenantId, unique_id: uniqueId },
      { $set: { store_image: image } }
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
    return await PaymentType.find(query).select("id title is_active icon").lean();
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
  paymentStatus = "pending"
) => {
  try {
    const order = await QROrder.create({
      delivery_type: deliveryType,
      customer_type: customerType,
      customer_id: customerId,
      table_id: tableId,
      payment_status: paymentStatus || "pending",
      tenant_id: tenantId,
    });

    const orderId = order.id;

    if (cartItems && cartItems.length > 0) {
      const itemsToInsert = cartItems.map((item) => ({
        order_id: orderId,
        item_id: item.id,
        variant_id: item.variant_id || null,
        price: item.price,
        quantity: item.quantity,
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

    return { orderId };
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
