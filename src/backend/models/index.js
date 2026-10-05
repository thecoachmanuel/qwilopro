const mongoose = require("mongoose");
const { getNextSequenceValue } = require("../db/counter");

// Helper to auto-assign integer `id` on creation if not provided
const applyAutoIncrementId = (schema, sequenceName) => {
  schema.pre("validate", async function (next) {
    if (this.isNew && (this.id === undefined || this.id === null)) {
      try {
        this.id = await getNextSequenceValue(sequenceName);
      } catch (err) {
        return next(err);
      }
    }
    next();
  });
};

// 1. Tenant
const tenantSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  name: { type: String, required: true },
  is_active: { type: Number, default: 0 },
  subscription_id: { type: String, default: null },
  payment_customer_id: { type: String, default: null },
  subscription_start: { type: Date, default: null },
  subscription_end: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  hasTrial: { type: Number, default: 0 },
  isTrialPlan: { type: Number, default: 0 },
  payment_gateway_product_id: { type: String, default: null },
  payment_gateway_price_id: { type: String, default: null },
  plan_id: { type: Number, default: null },
  plan_title: { type: String, default: null },
  token_version: { type: Number, default: 1 },
  stripe_next_price_id: { type: String, default: null },
  custom_domain: { type: String, default: null, index: true },
});
applyAutoIncrementId(tenantSchema, "tenants");

// 2. User
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  photo: { type: String, default: null },
  designation: { type: String, default: null },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  scope: { type: String, default: null },
  tenant_id: { type: Number, index: true, default: null },
});
userSchema.index({ tenant_id: 1, role: 1 });

// 3. SuperAdmin
const superAdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
});

// 4. StoreDetails
const storeDetailsSchema = new mongoose.Schema({
  tenant_id: { type: Number, required: true, unique: true, index: true },
  store_name: { type: String, default: "" },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  currency: { type: String, default: "NGN" },
  store_image: { type: String, default: null },
  is_qr_menu_enabled: { type: Number, default: 0 },
  unique_qr_code: { type: String, default: null, index: true },
  slug: { type: String, default: null, index: true },
  custom_domain: { type: String, default: null, index: true },
  is_qr_order_enabled: { type: Number, default: 0 },
  is_feedback_enabled: { type: Number, default: 0 },
  is_delivery_enabled: { type: Number, default: 0 },
  delivery_fee: { type: Number, default: 0 },
  unique_id: { type: String, default: null },
  service_charge: { type: Number, default: 0 },
});

// 5. StoreTable
const storeTableSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  table_title: { type: String, required: true },
  floor: { type: String, default: "" },
  seating_capacity: { type: Number, default: 4 },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(storeTableSchema, "store_tables");

// 6. Tax
const taxSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  title: { type: String, required: true },
  rate: { type: Number, required: true },
  type: { type: String, enum: ["inclusive", "exclusive", "other"], default: "other" },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(taxSchema, "taxes");

// 7. Category
const categorySchema = new mongoose.Schema({
  id: { type: Number, index: true },
  title: { type: String, required: true },
  tenant_id: { type: Number, required: true, index: true },
  is_enabled: { type: Boolean, default: true },
});
applyAutoIncrementId(categorySchema, "categories");
categorySchema.index({ tenant_id: 1, is_enabled: 1 });

// 8. MenuItem
const menuItemSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  title: { type: String, required: true },
  price: { type: Number, default: 0 },
  net_price: { type: Number, default: 0 },
  tax_id: { type: Number, default: null },
  image: { type: String, default: null },
  category: { type: Number, default: null, index: true },
  tenant_id: { type: Number, required: true, index: true },
  is_enabled: { type: Boolean, default: true },
  description: { type: String, default: "" },
});
applyAutoIncrementId(menuItemSchema, "menu_items");
menuItemSchema.index({ tenant_id: 1, is_enabled: 1 });
menuItemSchema.index({ tenant_id: 1, category: 1 });

// 9. MenuItemVariant
const menuItemVariantSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  item_id: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  price: { type: Number, default: 0 },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(menuItemVariantSchema, "menu_item_variants");

// 10. MenuItemAddon
const menuItemAddonSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  item_id: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  price: { type: Number, default: 0 },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(menuItemAddonSchema, "menu_item_addons");

// 11. MenuItemRecipe
const menuItemRecipeSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  menu_item_id: { type: Number, required: true, index: true },
  variant_id: { type: Number, default: 0 },
  addon_id: { type: Number, default: 0 },
  inventory_item_id: { type: Number, required: true, index: true },
  quantity: { type: Number, required: true },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(menuItemRecipeSchema, "menu_item_recipes");

// 12. Customer
const customerSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  tenant_id: { type: Number, required: true },
  name: { type: String, required: true },
  email: { type: String, default: null },
  birth_date: { type: Date, default: null },
  gender: { type: String, enum: ["male", "female", "other"], default: null },
  is_member: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  update_at: { type: Date, default: Date.now },
});
customerSchema.index({ phone: 1, tenant_id: 1 }, { unique: true });
customerSchema.index({ tenant_id: 1, created_at: -1 });

// 13. Order
const orderSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  date: { type: Date, default: Date.now, index: true },
  delivery_type: { type: String, default: null },
  customer_type: { type: String, enum: ["WALKIN", "CUSTOMER"], default: "WALKIN" },
  customer_id: { type: String, default: null },
  table_id: { type: Number, default: null },
  status: { type: String, enum: ["created", "completed", "cancelled"], default: "created" },
  token_no: { type: Number, default: 0 },
  payment_status: { type: String, enum: ["pending", "paid"], default: "pending" },
  invoice_id: { type: Number, default: null },
  tenant_id: { type: Number, required: true, index: true },
  created_by: { type: String, default: null },
  client_request_id: { type: String },
});
applyAutoIncrementId(orderSchema, "orders");
orderSchema.index(
  { tenant_id: 1, client_request_id: 1 },
  { unique: true, partialFilterExpression: { client_request_id: { $type: "string" } } }
);
orderSchema.index({ tenant_id: 1, date: -1 });
orderSchema.index({ tenant_id: 1, status: 1 });
orderSchema.index({ tenant_id: 1, payment_status: 1 });

// 14. OrderItem
const orderItemSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  order_id: { type: Number, required: true, index: true },
  item_id: { type: Number, required: true },
  variant_id: { type: Number, default: null },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ["created", "preparing", "completed", "cancelled", "delivered"], default: "created" },
  date: { type: Date, default: Date.now },
  notes: { type: String, default: "" },
  addons: { type: String, default: null },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(orderItemSchema, "order_items");
orderItemSchema.index({ tenant_id: 1, order_id: 1 });
orderItemSchema.index({ tenant_id: 1, date: -1 });

// 15. Invoice
const invoiceSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now, index: true },
  sub_total: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  payment_type_id: { type: Number, default: null },
  service_charge_total: { type: Number, default: 0 },
  created_by: { type: String, default: null },
});
invoiceSchema.index({ id: 1, tenant_id: 1 }, { unique: true });
invoiceSchema.index({ tenant_id: 1, created_at: -1 });

// 16. InvoiceSequence
const invoiceSequenceSchema = new mongoose.Schema({
  tenant_id: { type: Number, required: true, unique: true, index: true },
  sequence_no: { type: Number, default: 0 },
});

// 17. TokenSequence
const tokenSequenceSchema = new mongoose.Schema({
  tenant_id: { type: Number, required: true, unique: true, index: true },
  sequence_no: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now },
});

// 18. PaymentType
const paymentTypeSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  title: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  tenant_id: { type: Number, required: true, index: true },
  icon: { type: String, default: null },
});
applyAutoIncrementId(paymentTypeSchema, "payment_types");

// 19. PaymentGateway
const paymentGatewaySchema = new mongoose.Schema({
  id: { type: Number, index: true },
  gateway_name: { type: String, required: true, unique: true },
  credentials: { type: String, default: null },
  status: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(paymentGatewaySchema, "payment_gateways");

// 20. Plan
const planSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  title: { type: String, required: true },
  payment_gateway: { type: String, required: true },
  payment_gateway_product_id: { type: String, required: true, unique: true },
  is_recommended: { type: Boolean, default: false },
  is_trial: { type: Boolean, default: false },
  trial_days: { type: Number, default: 0 },
  features_description: { type: String, default: "" },
  features: { type: String, default: "" },
  yearly_discount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  is_deleted: { type: Boolean, default: false },
});
applyAutoIncrementId(planSchema, "plans");

// 21. PlanPrice
const planPriceSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  plan_id: { type: Number, required: true, index: true },
  country: { type: String, required: true },
  currency: { type: String, required: true },
  frequency: { type: String, enum: ["monthly", "yearly"], required: true },
  amount: { type: Number, required: true },
  payment_gateway_price_id: { type: String, default: null },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  symbol: { type: String, default: "$" },
  is_default: { type: Boolean, default: false },
});
applyAutoIncrementId(planPriceSchema, "plan_prices");

// 22. SubscriptionHistory
const subscriptionHistorySchema = new mongoose.Schema({
  id: { type: Number, index: true },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  starts_on: { type: Date, default: null },
  expires_on: { type: Date, default: null },
  status: { type: String, enum: ["created", "updated", "plan_changed", "active", "downgrade_scheduled", "cancelAtPeriodEnd", "cancelled"] },
});
applyAutoIncrementId(subscriptionHistorySchema, "subscription_history");

// 23. Reservation
const reservationSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  customer_id: { type: String, default: null, index: true },
  date: { type: Date, default: null, index: true },
  table_id: { type: Number, default: null },
  status: { type: String, default: "pending" },
  notes: { type: String, default: "" },
  people_count: { type: Number, default: 1 },
  unique_code: { type: String, default: null, index: true },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(reservationSchema, "reservations");
reservationSchema.index({ tenant_id: 1, date: 1 });
reservationSchema.index({ tenant_id: 1, status: 1 });

// 24. Feedback
const feedbackSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  invoice_id: { type: Number, default: null },
  phone: { type: String, default: null },
  date: { type: Date, default: Date.now },
  created_by: { type: String, default: null },
  average_rating: { type: Number, default: 0 },
  food_quality_rating: { type: Number, default: 0 },
  service_rating: { type: Number, default: 0 },
  staff_behavior_rating: { type: Number, default: 0 },
  ambiance_rating: { type: Number, default: 0 },
  recommend_rating: { type: Number, default: 0 },
  remarks: { type: String, default: "" },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(feedbackSchema, "feedbacks");
feedbackSchema.index({ tenant_id: 1, date: -1 });

// 25. RefreshToken
const refreshTokenSchema = new mongoose.Schema({
  device_id: { type: Number, index: true },
  username: { type: String, required: true, index: true },
  refresh_token: { type: String, required: true },
  device_ip: { type: String, default: "" },
  device_name: { type: String, default: "" },
  device_location: { type: String, default: "" },
  expiry: { type: Date, default: null },
  tenant_id: { type: Number, default: null },
  created_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(refreshTokenSchema, "refresh_tokens_device_id");

// 26. ResetPasswordToken
const resetPasswordTokenSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  reset_token: { type: String, default: null },
  expires_at: { type: Date, default: null },
});

// 27. PrintSetting
const printSettingSchema = new mongoose.Schema({
  tenant_id: { type: Number, required: true, unique: true, index: true },
  page_format: { type: String, default: "58mm" },
  header: { type: String, default: "" },
  footer: { type: String, default: "" },
  show_notes: { type: Boolean, default: true },
  is_enable_print: { type: Boolean, default: true },
  show_store_details: { type: Boolean, default: true },
  show_customer_details: { type: Boolean, default: true },
  print_token: { type: Boolean, default: true },
});

// 28. PrinterConfig
const printerConfigSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  tenant_id: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  transport: { type: String, enum: ["bluetooth", "tcp", "usb"], default: "bluetooth" },
  address: { type: String, required: true },
  paper_size: { type: Number, default: 80 },
  is_default: { type: Boolean, default: false },
  is_kot_printer: { type: Boolean, default: false },
  auto_cut: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(printerConfigSchema, "printer_configs");

// 29. InventoryItem
const inventoryItemSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  title: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, enum: ["pc", "kg", "g", "l", "ml"], required: true },
  min_quantity_threshold: { type: Number, default: 0 },
  status: { type: String, enum: ["low", "in", "out"], default: "out" },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(inventoryItemSchema, "inventory_items");

// 30. InventoryLog
const inventoryLogSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  tenant_id: { type: Number, required: true, index: true },
  inventory_item_id: { type: Number, required: true, index: true },
  type: { type: String, enum: ["IN", "OUT", "WASTAGE"], required: true },
  quantity_change: { type: Number, required: true },
  previous_quantity: { type: Number, default: 0 },
  new_quantity: { type: Number, default: 0 },
  note: { type: String, default: "" },
  created_by: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(inventoryLogSchema, "inventory_logs");

// 31. QROrder
const qrOrderSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  date: { type: Date, default: Date.now },
  delivery_type: { type: String, default: null },
  customer_type: { type: String, default: "WALKIN" },
  customer_id: { type: String, default: null },
  customer_name: { type: String, default: null },
  table_id: { type: Number, default: null },
  delivery_fee: { type: Number, default: 0 },
  status: { type: String, enum: ["created", "completed", "cancelled"], default: "created" },
  payment_status: { type: String, enum: ["pending", "paid"], default: "pending" },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(qrOrderSchema, "qr_orders");


// 32. QROrderItem
const qrOrderItemSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  order_id: { type: Number, required: true, index: true },
  item_id: { type: Number, required: true },
  variant_id: { type: Number, default: null },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ["created", "preparing", "completed", "cancelled", "delivered"], default: "created" },
  date: { type: Date, default: Date.now },
  notes: { type: String, default: "" },
  addons: { type: String, default: null },
  tenant_id: { type: Number, required: true, index: true },
});
applyAutoIncrementId(qrOrderItemSchema, "qr_order_items");

// 33. ExchangeRate
const exchangeRateSchema = new mongoose.Schema({
  currency_code: { type: String, required: true, unique: true },
  rate_to_usd: { type: Number, required: true },
});

// 34. InventoryVendor
const inventoryVendorSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  phone: { type: String, required: true },
  name: { type: String, required: true },
  contact_person: { type: String, default: "" },
  address_line1: { type: String, default: "" },
  address_line2: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  zipcode: { type: String, default: "" },
  tax_id_no: { type: String, default: "" },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(inventoryVendorSchema, "inventory_vendors");

// 35. InventoryPurchaseOrderDraft
const inventoryPurchaseOrderDraftSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  item_id: { type: Number, required: true },
  quantity: { type: Number, required: true },
  tenant_id: { type: Number, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});
applyAutoIncrementId(inventoryPurchaseOrderDraftSchema, "inventory_purchase_orders_drafts");

// 36. InventoryPurchaseOrder
const inventoryPurchaseOrderSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  tenant_id: { type: Number, required: true, index: true },
  vendor_id: { type: Number, default: null },
  vendor_name: { type: String, default: "" },
  contact_person: { type: String, default: "" },
  tax_id_no: { type: String, default: "" },
  address: { type: String, default: "" },
  created_by: { type: String, default: "" },
  notes: { type: String, default: "" },
  status: { type: String, enum: ["ordered", "completed", "cancelled"], default: "ordered" },
  created_at: { type: Date, default: Date.now },
  fullfilled_at: { type: Date, default: null },
});
applyAutoIncrementId(inventoryPurchaseOrderSchema, "inventory_purchase_orders");

// 37. InventoryPurchaseOrderItem
const inventoryPurchaseOrderItemSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  purchase_order_id: { type: Number, required: true, index: true },
  tenant_id: { type: Number, required: true, index: true },
  inventory_item_id: { type: Number, required: true },
  inventory_item_name: { type: String, default: "" },
  inventory_item_unit: { type: String, default: "" },
  quantity: { type: Number, required: true },
});
applyAutoIncrementId(inventoryPurchaseOrderItemSchema, "inventory_purchase_order_items");

module.exports = {
  Tenant: mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema),
  User: mongoose.models.User || mongoose.model("User", userSchema),
  SuperAdmin: mongoose.models.SuperAdmin || mongoose.model("SuperAdmin", superAdminSchema),
  StoreDetails: mongoose.models.StoreDetails || mongoose.model("StoreDetails", storeDetailsSchema),
  StoreTable: mongoose.models.StoreTable || mongoose.model("StoreTable", storeTableSchema),
  Tax: mongoose.models.Tax || mongoose.model("Tax", taxSchema),
  Category: mongoose.models.Category || mongoose.model("Category", categorySchema),
  MenuItem: mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema),
  MenuItemVariant: mongoose.models.MenuItemVariant || mongoose.model("MenuItemVariant", menuItemVariantSchema),
  MenuItemAddon: mongoose.models.MenuItemAddon || mongoose.model("MenuItemAddon", menuItemAddonSchema),
  MenuItemRecipe: mongoose.models.MenuItemRecipe || mongoose.model("MenuItemRecipe", menuItemRecipeSchema),
  Customer: mongoose.models.Customer || mongoose.model("Customer", customerSchema),
  Order: mongoose.models.Order || mongoose.model("Order", orderSchema),
  OrderItem: mongoose.models.OrderItem || mongoose.model("OrderItem", orderItemSchema),
  Invoice: mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema),
  InvoiceSequence: mongoose.models.InvoiceSequence || mongoose.model("InvoiceSequence", invoiceSequenceSchema),
  TokenSequence: mongoose.models.TokenSequence || mongoose.model("TokenSequence", tokenSequenceSchema),
  PaymentType: mongoose.models.PaymentType || mongoose.model("PaymentType", paymentTypeSchema),
  PaymentGateway: mongoose.models.PaymentGateway || mongoose.model("PaymentGateway", paymentGatewaySchema),
  Plan: mongoose.models.Plan || mongoose.model("Plan", planSchema),
  PlanPrice: mongoose.models.PlanPrice || mongoose.model("PlanPrice", planPriceSchema),
  SubscriptionHistory: mongoose.models.SubscriptionHistory || mongoose.model("SubscriptionHistory", subscriptionHistorySchema),
  Reservation: mongoose.models.Reservation || mongoose.model("Reservation", reservationSchema),
  Feedback: mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema),
  RefreshToken: mongoose.models.RefreshToken || mongoose.model("RefreshToken", refreshTokenSchema),
  ResetPasswordToken: mongoose.models.ResetPasswordToken || mongoose.model("ResetPasswordToken", resetPasswordTokenSchema),
  PrintSetting: mongoose.models.PrintSetting || mongoose.model("PrintSetting", printSettingSchema),
  PrinterConfig: mongoose.models.PrinterConfig || mongoose.model("PrinterConfig", printerConfigSchema),
  InventoryItem: mongoose.models.InventoryItem || mongoose.model("InventoryItem", inventoryItemSchema),
  InventoryLog: mongoose.models.InventoryLog || mongoose.model("InventoryLog", inventoryLogSchema),
  QROrder: mongoose.models.QROrder || mongoose.model("QROrder", qrOrderSchema),
  QROrderItem: mongoose.models.QROrderItem || mongoose.model("QROrderItem", qrOrderItemSchema),
  ExchangeRate: mongoose.models.ExchangeRate || mongoose.model("ExchangeRate", exchangeRateSchema),
  InventoryVendor: mongoose.models.InventoryVendor || mongoose.model("InventoryVendor", inventoryVendorSchema),
  InventoryPurchaseOrderDraft: mongoose.models.InventoryPurchaseOrderDraft || mongoose.model("InventoryPurchaseOrderDraft", inventoryPurchaseOrderDraftSchema),
  InventoryPurchaseOrder: mongoose.models.InventoryPurchaseOrder || mongoose.model("InventoryPurchaseOrder", inventoryPurchaseOrderSchema),
  InventoryPurchaseOrderItem: mongoose.models.InventoryPurchaseOrderItem || mongoose.model("InventoryPurchaseOrderItem", inventoryPurchaseOrderItemSchema),
  SystemSetting: mongoose.models.SystemSetting || mongoose.model("SystemSetting", new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
    updated_at: { type: Date, default: Date.now },
  })),
};
