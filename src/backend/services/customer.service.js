const { Customer } = require("../models");

exports.doCustomerExistDB = async (phone, tenantId) => {
  try {
    const customer = await Customer.findOne({ phone, tenant_id: tenantId }).select("phone name").lean();
    return !!customer;
  } catch (error) {
    console.error("doCustomerExistDB Error:", error);
    throw error;
  }
};

exports.addCustomerDB = async (phone, name, email, birthDate, gender, isMember, tenantId) => {
  try {
    const customer = await Customer.create({
      phone,
      name,
      email: email || null,
      birth_date: birthDate || null,
      gender: gender || null,
      is_member: !!isMember,
      tenant_id: tenantId,
    });
    return customer.phone;
  } catch (error) {
    console.error("addCustomerDB Error:", error);
    throw error;
  }
};

exports.getCustomersDB = async (page, perPage, sort, filter, tenantId) => {
  try {
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(perPage) || 10;
    const skip = (currentPage - 1) * limit;

    const query = { tenant_id: tenantId };
    if (filter) {
      query.$or = [
        { name: { $regex: filter, $options: "i" } },
        { phone: { $regex: filter, $options: "i" } },
      ];
    }

    let sortObj = { created_at: -1 };
    if (sort) {
      if (sort.startsWith("-")) {
        sortObj = { [sort.substring(1)]: -1 };
      } else {
        sortObj = { [sort]: 1 };
      }
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .select("phone name email birth_date gender is_member created_at")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return {
      customers,
      currentPage,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
      totalCustomers: total,
    };
  } catch (error) {
    console.error("getCustomersDB Error:", error);
    throw error;
  }
};

exports.getAllCustomersDB = async (tenantId) => {
  try {
    return await Customer.find({ tenant_id: tenantId })
      .select("phone name email birth_date gender is_member created_at")
      .sort({ created_at: -1 })
      .lean();
  } catch (error) {
    console.error("getAllCustomersDB Error:", error);
    throw error;
  }
};

exports.uploadBulkCustomersDB = async (customers) => {
  try {
    const operations = customers.map((c) => {
      const [phone, name, email, birth_date, gender, tenant_id] = Array.isArray(c)
        ? c
        : [c.phone, c.name, c.email, c.birth_date, c.gender, c.tenant_id];

      return {
        updateOne: {
          filter: { phone, tenant_id },
          update: {
            $set: {
              name,
              email: email || null,
              birth_date: birth_date || null,
              gender: gender || null,
            },
          },
          upsert: true,
        },
      };
    });

    return await Customer.bulkWrite(operations);
  } catch (error) {
    console.error("uploadBulkCustomersDB Error:", error);
    throw error;
  }
};

exports.getCustomerDB = async (phone, tenantId) => {
  try {
    return await Customer.findOne({ phone, tenant_id: tenantId })
      .select("phone name email birth_date gender is_member created_at")
      .lean();
  } catch (error) {
    console.error("getCustomerDB Error:", error);
    throw error;
  }
};

exports.searchCustomerDB = async (searchString, tenantId) => {
  try {
    return await Customer.find({
      tenant_id: tenantId,
      $or: [
        { phone: { $regex: `^${searchString}`, $options: "i" } },
        { name: { $regex: searchString, $options: "i" } },
      ],
    })
      .select("phone name email birth_date gender is_member created_at")
      .limit(10)
      .lean();
  } catch (error) {
    console.error("searchCustomerDB Error:", error);
    throw error;
  }
};

exports.updateCustomerDB = async (phone, name, email, birthDate, gender, tenantId) => {
  try {
    await Customer.updateOne(
      { phone, tenant_id: tenantId },
      {
        $set: {
          name,
          email: email || null,
          birth_date: birthDate || null,
          gender: gender || null,
          update_at: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("updateCustomerDB Error:", error);
    throw error;
  }
};

exports.deleteCustomerDB = async (phone, tenantId) => {
  try {
    await Customer.deleteOne({ phone, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteCustomerDB Error:", error);
    throw error;
  }
};
