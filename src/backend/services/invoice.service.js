const {
  Order,
  Invoice,
  Customer,
  StoreTable,
  OrderItem,
  MenuItem,
  MenuItemVariant,
  MenuItemAddon,
  Tax,
} = require("../models");

const getDateRangeFilter = (type, from, to) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (type) {
    case "custom": {
      return {
        $gte: new Date(from),
        $lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
      };
    }
    case "today": {
      return { $gte: startOfDay, $lte: endOfDay };
    }
    case "this_month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { $gte: startOfMonth, $lte: endOfMonth };
    }
    case "last_month": {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { $gte: oneMonthAgo, $lte: endOfDay };
    }
    case "last_7days": {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { $gte: sevenDaysAgo, $lte: endOfDay };
    }
    case "yesterday": {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { $gte: startOfYesterday, $lte: endOfYesterday };
    }
    case "tomorrow": {
      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
      return { $gte: startOfTomorrow, $lte: endOfTomorrow };
    }
    default:
      return null;
  }
};

exports.getInvoicesDB = async (type, from, to, tenantId) => {
  try {
    const invoiceQuery = { tenant_id: tenantId };
    const dateFilter = getDateRangeFilter(type, from, to);
    if (dateFilter) {
      invoiceQuery.created_at = dateFilter;
    }

    const invoices = await Invoice.find(invoiceQuery).sort({ created_at: -1 }).lean();
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.id);
    const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

    const orders = await Order.find({
      invoice_id: { $in: invoiceIds },
      tenant_id: tenantId,
    }).lean();

    const customerIds = orders.map((o) => o.customer_id).filter(Boolean);
    const tableIds = orders.map((o) => o.table_id).filter(Boolean);

    const [customers, tables] = await Promise.all([
      Customer.find({ phone: { $in: customerIds }, tenant_id: tenantId }).select("phone name email").lean(),
      StoreTable.find({ id: { $in: tableIds }, tenant_id: tenantId }).select("id table_title floor").lean(),
    ]);

    const customerMap = new Map(customers.map((c) => [c.phone, c]));
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    return orders.map((o) => {
      const invoice = invoiceMap.get(o.invoice_id) || {};
      const customer = customerMap.get(o.customer_id);
      const table = tableMap.get(o.table_id);

      return {
        invoice_id: o.invoice_id,
        order_id: o.id,
        created_at: invoice.created_at || o.date,
        sub_total: invoice.sub_total || 0,
        tax_total: invoice.tax_total || 0,
        service_charge_total: invoice.service_charge_total || 0,
        total: invoice.total || 0,
        table_id: o.table_id,
        table_title: table?.table_title || null,
        floor: table?.floor || null,
        payment_status: o.payment_status,
        token_no: o.token_no,
        delivery_type: o.delivery_type,
        customer_type: o.customer_type,
        customer_id: o.customer_id,
        name: customer?.name || "Walk-in Customer",
        email: customer?.email || null,
        payment_type_id: invoice.payment_type_id || null,
      };
    });
  } catch (error) {
    console.error("getInvoicesDB Error:", error);
    throw error;
  }
};

exports.searchInvoicesDB = async (search, tenantId) => {
  try {
    const isNum = !isNaN(search);
    const numSearch = isNum ? Number(search) : -1;

    const matchedCustomers = await Customer.find({
      tenant_id: tenantId,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    }).select("phone name email").lean();

    const matchedPhones = matchedCustomers.map((c) => c.phone);

    const orderQuery = {
      tenant_id: tenantId,
      $or: [
        { invoice_id: numSearch },
        { id: numSearch },
        { customer_id: { $in: matchedPhones } },
        { customer_id: { $regex: search, $options: "i" } },
      ],
    };

    const orders = await Order.find(orderQuery).sort({ date: -1 }).limit(20).lean();
    if (orders.length === 0) return [];

    const invoiceIds = orders.map((o) => o.invoice_id).filter(Boolean);
    const tableIds = orders.map((o) => o.table_id).filter(Boolean);
    const customerIds = orders.map((o) => o.customer_id).filter(Boolean);

    const [invoices, tables, allCustomers] = await Promise.all([
      Invoice.find({ id: { $in: invoiceIds }, tenant_id: tenantId }).lean(),
      StoreTable.find({ id: { $in: tableIds }, tenant_id: tenantId }).select("id table_title floor").lean(),
      Customer.find({ phone: { $in: customerIds }, tenant_id: tenantId }).select("phone name email").lean(),
    ]);

    const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
    const tableMap = new Map(tables.map((t) => [t.id, t]));
    const customerMap = new Map(allCustomers.map((c) => [c.phone, c]));

    return orders.map((o) => {
      const invoice = invoiceMap.get(o.invoice_id) || {};
      const customer = customerMap.get(o.customer_id);
      const table = tableMap.get(o.table_id);

      return {
        invoice_id: o.invoice_id,
        order_id: o.id,
        created_at: invoice.created_at || o.date,
        sub_total: invoice.sub_total || 0,
        tax_total: invoice.tax_total || 0,
        service_charge_total: invoice.service_charge_total || 0,
        total: invoice.total || 0,
        table_id: o.table_id,
        table_title: table?.table_title || null,
        floor: table?.floor || null,
        payment_status: o.payment_status,
        token_no: o.token_no,
        delivery_type: o.delivery_type,
        customer_type: o.customer_type,
        customer_id: o.customer_id,
        name: customer?.name || "Walk-in Customer",
        email: customer?.email || null,
        payment_type_id: invoice.payment_type_id || null,
      };
    });
  } catch (error) {
    console.error("searchInvoicesDB Error:", error);
    throw error;
  }
};

exports.getInvoiceOrdersDB = async (orderIdsToFindSummary, tenantId = null) => {
  try {
    const ids = Array.isArray(orderIdsToFindSummary)
      ? orderIdsToFindSummary
      : String(orderIdsToFindSummary).split(",").map(Number);

    const orderQuery = {
      id: { $in: ids },
      status: { $ne: "cancelled" },
    };
    if (tenantId) {
      orderQuery.tenant_id = tenantId;
    }

    const rawOrders = await Order.find(orderQuery).lean();

    const customerIds = rawOrders.map((o) => o.customer_id).filter(Boolean);
    const tableIds = rawOrders.map((o) => o.table_id).filter(Boolean);

    const customerQuery = { phone: { $in: customerIds } };
    const tableQuery = { id: { $in: tableIds } };
    if (tenantId) {
      customerQuery.tenant_id = tenantId;
      tableQuery.tenant_id = tenantId;
    }

    const [customers, tables] = await Promise.all([
      Customer.find(customerQuery).select("phone name").lean(),
      StoreTable.find(tableQuery).select("id table_title floor").lean(),
    ]);

    const customerMap = new Map(customers.map((c) => [c.phone, c.name]));
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const kitchenOrders = rawOrders.map((o) => {
      const table = tableMap.get(o.table_id);
      return {
        id: o.id,
        date: o.date,
        delivery_type: o.delivery_type,
        customer_type: o.customer_type,
        customer_id: o.customer_id,
        customer_name: customerMap.get(o.customer_id) || "Walk-in Customer",
        table_id: o.table_id,
        table_title: table?.table_title || null,
        floor: table?.floor || null,
        status: o.status,
        payment_status: o.payment_status,
        token_no: o.token_no,
      };
    });

    let kitchenOrdersItems = [];
    let addons = [];

    if (kitchenOrders.length > 0) {
      const orderIds = kitchenOrders.map((o) => o.id);
      const itemQuery = {
        order_id: { $in: orderIds },
        status: { $ne: "cancelled" },
      };
      if (tenantId) {
        itemQuery.tenant_id = tenantId;
      }
      const rawItems = await OrderItem.find(itemQuery).lean();

      const itemIds = rawItems.map((i) => i.item_id);
      const menuQuery = { id: { $in: itemIds } };
      if (tenantId) menuQuery.tenant_id = tenantId;
      const menuItems = await MenuItem.find(menuQuery).lean();

      const taxIds = menuItems.map((m) => m.tax_id).filter(Boolean);
      const taxQuery = { id: { $in: taxIds } };
      if (tenantId) taxQuery.tenant_id = tenantId;
      const taxes = await Tax.find(taxQuery).lean();

      const variantQuery = { item_id: { $in: itemIds } };
      if (tenantId) variantQuery.tenant_id = tenantId;
      const variants = await MenuItemVariant.find(variantQuery).lean();

      const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
      const taxMap = new Map(taxes.map((t) => [t.id, t]));
      const variantMap = new Map(variants.map((v) => [`${v.item_id}_${v.id}`, v]));

      kitchenOrdersItems = rawItems.map((oi) => {
        const mi = menuItemMap.get(oi.item_id);
        const tax = mi?.tax_id ? taxMap.get(mi.tax_id) : null;
        const variant = oi.variant_id ? variantMap.get(`${oi.item_id}_${oi.variant_id}`) : null;

        return {
          id: oi.id,
          order_id: oi.order_id,
          item_id: oi.item_id,
          item_title: mi?.title || "",
          variant_id: oi.variant_id,
          variant_title: variant?.title || null,
          variant_price: variant?.price || 0,
          price: mi?.price || oi.price,
          tax_id: mi?.tax_id || null,
          tax_title: tax?.title || null,
          tax_rate: tax?.rate || 0,
          tax_type: tax?.type || "other",
          quantity: oi.quantity,
          status: oi.status,
          date: oi.date,
          addons: oi.addons,
          notes: oi.notes,
        };
      });

      const allAddonIds = [
        ...new Set(
          kitchenOrdersItems.flatMap((o) => {
            try {
              return o.addons ? JSON.parse(o.addons) : [];
            } catch {
              return [];
            }
          })
        ),
      ];

      if (allAddonIds.length > 0) {
        const numericIds = allAddonIds.map(Number).filter((n) => !isNaN(n));
        const combined = [...new Set([...allAddonIds, ...numericIds])];
        const addonQuery = { id: { $in: combined } };
        if (tenantId) addonQuery.tenant_id = tenantId;
        addons = await MenuItemAddon.find(addonQuery)
          .select("id item_id title price")
          .lean();
      }
    }

    return {
      kitchenOrders,
      kitchenOrdersItems,
      addons,
    };
  } catch (error) {
    console.error("getInvoiceOrdersDB Error:", error);
    throw error;
  }
};

exports.getInvoiceByIdDB = async (id, tenantId) => {
  try {
    return await Invoice.findOne({ id, tenant_id: tenantId })
      .select("id created_at sub_total tax_total service_charge_total total payment_type_id")
      .lean();
  } catch (error) {
    console.error("getInvoiceByIdDB Error:", error);
    throw error;
  }
};
