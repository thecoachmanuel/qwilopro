const { Feedback } = require("../models");

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

exports.getOverallFeedbackSummaryDB = async (tenantId) => {
  const tId = Number(tenantId);
  const results = await Feedback.aggregate([
    { $match: { tenant_id: tId } },
    {
      $group: {
        _id: null,
        loved: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ["$average_rating", 4.5] }, { $lte: ["$average_rating", 5] }] },
              1,
              0,
            ],
          },
        },
        good: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ["$average_rating", 3.5] }, { $lt: ["$average_rating", 4.5] }] },
              1,
              0,
            ],
          },
        },
        average: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ["$average_rating", 2.5] }, { $lt: ["$average_rating", 3.5] }] },
              1,
              0,
            ],
          },
        },
        bad: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ["$average_rating", 1.5] }, { $lt: ["$average_rating", 2.5] }] },
              1,
              0,
            ],
          },
        },
        worst: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ["$average_rating", 1] }, { $lt: ["$average_rating", 1.5] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return results[0] || { loved: 0, good: 0, average: 0, bad: 0, worst: 0 };
};

exports.getOverallFeedbackSummaryByQuestionDB = async (tenantId) => {
  const tId = Number(tenantId);
  const results = await Feedback.aggregate([
    { $match: { tenant_id: tId } },
    {
      $group: {
        _id: null,
        food_quality_rating: { $avg: "$food_quality_rating" },
        service_rating: { $avg: "$service_rating" },
        staff_behavior_rating: { $avg: "$staff_behavior_rating" },
        ambiance_rating: { $avg: "$ambiance_rating" },
        recommend_rating: { $avg: "$recommend_rating" },
        average_rating: { $avg: "$average_rating" },
      },
    },
  ]);
  return (
    results[0] || {
      food_quality_rating: 0,
      service_rating: 0,
      staff_behavior_rating: 0,
      ambiance_rating: 0,
      recommend_rating: 0,
      average_rating: 0,
    }
  );
};

exports.getFeedbacksDB = async (type, from, to, tenantId) => {
  const tId = Number(tenantId);
  const dateFilter = buildDateFilter(type, from, to);

  const results = await Feedback.aggregate([
    { $match: { tenant_id: tId, ...dateFilter } },
    {
      $lookup: {
        from: "customers",
        let: { custPhone: "$phone", tId: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$phone", "$$custPhone"] }, { $eq: ["$tenant_id", "$$tId"] }] } } },
          { $project: { name: 1 } },
        ],
        as: "customer",
      },
    },
    {
      $project: {
        id: 1,
        invoice_id: 1,
        date: 1,
        phone: 1,
        name: { $ifNull: [{ $arrayElemAt: ["$customer.name", 0] }, null] },
        average_rating: 1,
        food_quality_rating: 1,
        service_rating: 1,
        staff_behavior_rating: 1,
        ambiance_rating: 1,
        recommend_rating: 1,
        remarks: 1,
      },
    },
    { $sort: { date: -1 } },
  ]);

  return results;
};

exports.searchFeedbacksDB = async (search, tenantId) => {
  const tId = Number(tenantId);
  const numSearch = Number(search);

  const pipeline = [
    {
      $lookup: {
        from: "customers",
        let: { custPhone: "$phone", tId: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$phone", "$$custPhone"] }, { $eq: ["$tenant_id", "$$tId"] }] } } },
          { $project: { name: 1 } },
        ],
        as: "customer",
      },
    },
    {
      $project: {
        id: 1,
        invoice_id: 1,
        date: 1,
        phone: 1,
        name: { $ifNull: [{ $arrayElemAt: ["$customer.name", 0] }, null] },
        average_rating: 1,
        food_quality_rating: 1,
        service_rating: 1,
        staff_behavior_rating: 1,
        ambiance_rating: 1,
        recommend_rating: 1,
        remarks: 1,
        tenant_id: 1,
      },
    },
    {
      $match: {
        tenant_id: tId,
        $or: [
          ...(isNaN(numSearch) ? [] : [{ invoice_id: numSearch }]),
          { phone: { $regex: search, $options: "i" } },
          { name: { $regex: search, $options: "i" } },
        ],
      },
    },
    { $sort: { date: -1 } },
  ];

  return await Feedback.aggregate(pipeline);
};