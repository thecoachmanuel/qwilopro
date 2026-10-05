const { Reservation } = require("../models");

const buildDateFilter = (type, from, to) => {
  const now = new Date();
  const startOfDay = (d) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const endOfDay = (d) => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  switch (type) {
    case "custom": {
      const start = from ? startOfDay(new Date(from)) : new Date(0);
      const end = to ? endOfDay(new Date(to)) : new Date();
      return { date: { $gte: start, $lte: end } };
    }
    case "today": {
      return { date: { $gte: startOfDay(now), $lte: endOfDay(now) } };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { date: { $gte: start, $lte: end } };
    }
    case "last_month": {
      const past = new Date(now);
      past.setMonth(past.getMonth() - 1);
      return { date: { $gte: startOfDay(past), $lte: endOfDay(now) } };
    }
    case "last_7days": {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      return { date: { $gte: startOfDay(past), $lte: endOfDay(now) } };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { date: { $gte: startOfDay(y), $lte: endOfDay(y) } };
    }
    case "tomorrow": {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      return { date: { $gte: startOfDay(t), $lte: endOfDay(t) } };
    }
    default:
      return {};
  }
};

exports.addReservationDB = async (customerId, date, tableId, status, notes, peopleCount, uniqueCode, tenantId) => {
  const doc = await Reservation.create({
    customer_id: customerId,
    date: new Date(date),
    table_id: tableId ? Number(tableId) : null,
    status: status || "pending",
    notes: notes || "",
    people_count: Number(peopleCount) || 1,
    unique_code: uniqueCode,
    tenant_id: Number(tenantId),
  });
  return doc.id;
};

exports.updateReservationDB = async (reservationId, date, tableId, status, notes, peopleCount, tenantId) => {
  await Reservation.updateOne(
    { id: Number(reservationId), tenant_id: Number(tenantId) },
    {
      $set: {
        date: new Date(date),
        table_id: tableId ? Number(tableId) : null,
        status,
        notes,
        people_count: Number(peopleCount) || 1,
        updated_at: new Date(),
      },
    }
  );
};

exports.cancelReservationDB = async (reservationId, status, tenantId) => {
  await Reservation.updateOne(
    { id: Number(reservationId), tenant_id: Number(tenantId) },
    { $set: { status, updated_at: new Date() } }
  );
};

exports.deleteReservationDB = async (reservationId, tenantId) => {
  await Reservation.deleteOne({ id: Number(reservationId), tenant_id: Number(tenantId) });
};

exports.searchReservationsDB = async (search, tenant_id) => {
  const tId = Number(tenant_id);
  const matchCriteria = {
    tenant_id: tId,
    $or: [{ customer_id: search }, { unique_code: search }],
  };
  const numSearch = Number(search);
  if (!isNaN(numSearch)) {
    matchCriteria.$or.push({ id: numSearch });
  }

  const results = await Reservation.aggregate([
    { $match: matchCriteria },
    {
      $lookup: {
        from: "customers",
        let: { custPhone: "$customer_id", tenantId: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$phone", "$$custPhone"] }, { $eq: ["$tenant_id", "$$tenantId"] }] } } },
          { $project: { name: 1 } },
        ],
        as: "customer",
      },
    },
    {
      $lookup: {
        from: "store_tables",
        let: { tblId: "$table_id", tenantId: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$id", "$$tblId"] }, { $eq: ["$tenant_id", "$$tenantId"] }] } } },
          { $project: { table_title: 1 } },
        ],
        as: "table",
      },
    },
    {
      $project: {
        id: 1,
        customer_id: 1,
        customer_name: { $ifNull: [{ $arrayElemAt: ["$customer.name", 0] }, ""] },
        date: 1,
        table_id: 1,
        table_title: { $ifNull: [{ $arrayElemAt: ["$table.table_title", 0] }, null] },
        status: 1,
        notes: 1,
        people_count: 1,
        unique_code: 1,
        created_at: 1,
        updated_at: 1,
      },
    },
    { $sort: { created_at: -1 } },
    { $limit: 20 },
  ]);
  return results;
};

exports.getReservationsDB = async (type, from, to, tenantId) => {
  const tId = Number(tenantId);
  const dateFilter = buildDateFilter(type, from, to);
  const matchCriteria = {
    tenant_id: tId,
    ...dateFilter,
  };

  const results = await Reservation.aggregate([
    { $match: matchCriteria },
    {
      $lookup: {
        from: "customers",
        let: { custPhone: "$customer_id", tenantId: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$phone", "$$custPhone"] }, { $eq: ["$tenant_id", "$$tenantId"] }] } } },
          { $project: { name: 1 } },
        ],
        as: "customer",
      },
    },
    {
      $lookup: {
        from: "store_tables",
        let: { tblId: "$table_id", tenantId: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$id", "$$tblId"] }, { $eq: ["$tenant_id", "$$tenantId"] }] } } },
          { $project: { table_title: 1 } },
        ],
        as: "table",
      },
    },
    {
      $project: {
        id: 1,
        customer_id: 1,
        customer_name: { $ifNull: [{ $arrayElemAt: ["$customer.name", 0] }, ""] },
        date: 1,
        table_id: 1,
        table_title: { $ifNull: [{ $arrayElemAt: ["$table.table_title", 0] }, null] },
        status: 1,
        notes: 1,
        people_count: 1,
        unique_code: 1,
        created_at: 1,
        updated_at: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);
  return results;
};
