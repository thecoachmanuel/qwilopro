const { PrinterConfig } = require("../models");

/**
 * Get all printer configs for a tenant.
 */
exports.getPrinterConfigsDB = async (tenantId) => {
  const rows = await PrinterConfig.find(
    { tenant_id: Number(tenantId) },
    { _id: 0, id: 1, name: 1, transport: 1, address: 1, paper_size: 1, is_default: 1, is_kot_printer: 1, auto_cut: 1 }
  )
    .sort({ is_default: -1, is_kot_printer: -1, name: 1 })
    .lean();

  // Convert boolean to 1/0 or maintain boolean depending on frontend expectations
  return rows.map((r) => ({
    ...r,
    is_default: r.is_default ? 1 : 0,
    is_kot_printer: r.is_kot_printer ? 1 : 0,
    auto_cut: r.auto_cut ? 1 : 0,
  }));
};

/**
 * Add a printer config.
 * Enforces single-default and single-KOT within the tenant.
 */
exports.addPrinterConfigDB = async (
  tenantId,
  { name, transport, address, paper_size, is_default, is_kot_printer, auto_cut }
) => {
  const tId = Number(tenantId);

  // If this printer is the default, unmark other defaults
  if (is_default) {
    await PrinterConfig.updateMany({ tenant_id: tId }, { $set: { is_default: false } });
  }

  // If this printer is the KOT printer, unmark other KOT printers
  if (is_kot_printer) {
    await PrinterConfig.updateMany({ tenant_id: tId }, { $set: { is_kot_printer: false } });
  }

  // Check if this is the first printer — if so, make it default
  const count = await PrinterConfig.countDocuments({ tenant_id: tId });
  const isFirst = count === 0;

  const doc = await PrinterConfig.create({
    tenant_id: tId,
    name,
    transport: transport || "bluetooth",
    address,
    paper_size: Number(paper_size) || 80,
    is_default: isFirst ? true : !!is_default,
    is_kot_printer: !!is_kot_printer,
    auto_cut: auto_cut !== undefined ? !!auto_cut : true,
  });

  return doc.id;
};

/**
 * Update a printer config.
 */
exports.updatePrinterConfigDB = async (tenantId, printerId, updates) => {
  const tId = Number(tenantId);
  const pId = Number(printerId);

  // If setting as default, unmark others
  if (updates.is_default) {
    await PrinterConfig.updateMany({ tenant_id: tId }, { $set: { is_default: false } });
  }

  // If setting as KOT, unmark others
  if (updates.is_kot_printer) {
    await PrinterConfig.updateMany({ tenant_id: tId }, { $set: { is_kot_printer: false } });
  }

  const setObj = {};
  const allowedFields = ["name", "transport", "address", "paper_size", "is_default", "is_kot_printer", "auto_cut"];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === "is_default" || field === "is_kot_printer" || field === "auto_cut") {
        setObj[field] = !!updates[field];
      } else if (field === "paper_size") {
        setObj[field] = Number(updates[field]);
      } else {
        setObj[field] = updates[field];
      }
    }
  }

  if (Object.keys(setObj).length === 0) {
    return;
  }

  setObj.updated_at = new Date();

  await PrinterConfig.updateOne({ id: pId, tenant_id: tId }, { $set: setObj });
};

/**
 * Delete a printer config.
 */
exports.deletePrinterConfigDB = async (tenantId, printerId) => {
  await PrinterConfig.deleteOne({ id: Number(printerId), tenant_id: Number(tenantId) });
};
