const {
  MenuItem,
  Category,
  Tax,
  MenuItemVariant,
  MenuItemAddon,
  MenuItemRecipe,
  InventoryItem,
} = require("../models");

exports.addMenuItemDB = async (title, description, price, netPrice, taxId, categoryId, tenantId) => {
  try {
    const item = await MenuItem.create({
      title,
      description: description || "",
      price: Number(price || 0),
      net_price: Number(netPrice || 0),
      tax_id: taxId ? Number(taxId) : null,
      category: categoryId ? Number(categoryId) : null,
      tenant_id: tenantId,
      is_enabled: true,
    });
    return item.id;
  } catch (error) {
    console.error("addMenuItemDB Error:", error);
    throw error;
  }
};

exports.updateMenuItemDB = async (id, title, description, price, netPrice, taxId, categoryId, tenantId) => {
  try {
    await MenuItem.updateOne(
      { id, tenant_id: tenantId },
      {
        $set: {
          title,
          description: description || "",
          price: Number(price || 0),
          net_price: Number(netPrice || 0),
          tax_id: taxId ? Number(taxId) : null,
          category: categoryId ? Number(categoryId) : null,
        },
      }
    );
  } catch (error) {
    console.error("updateMenuItemDB Error:", error);
    throw error;
  }
};

exports.updateMenuItemImageDB = async (id, image, tenantId) => {
  try {
    await MenuItem.updateOne({ id, tenant_id: tenantId }, { $set: { image } });
  } catch (error) {
    console.error("updateMenuItemImageDB Error:", error);
    throw error;
  }
};

exports.deleteMenuItemDB = async (id, tenantId) => {
  try {
    await Promise.all([
      MenuItem.deleteOne({ id, tenant_id: tenantId }),
      MenuItemVariant.deleteMany({ item_id: id, tenant_id: tenantId }),
      MenuItemAddon.deleteMany({ item_id: id, tenant_id: tenantId }),
      MenuItemRecipe.deleteMany({ menu_item_id: id, tenant_id: tenantId }),
    ]);
  } catch (error) {
    console.error("deleteMenuItemDB Error:", error);
    throw error;
  }
};

exports.changeMenuItemVisibilityDB = async (id, isEnabled, tenantId) => {
  try {
    await MenuItem.updateOne({ id, tenant_id: tenantId }, { $set: { is_enabled: !!isEnabled } });
  } catch (error) {
    console.error("changeMenuItemVisibilityDB Error:", error);
    throw error;
  }
};

exports.getAllMenuItemsDB = async (tenantId) => {
  try {
    const [items, taxes, categories] = await Promise.all([
      MenuItem.find({ tenant_id: tenantId }).lean(),
      Tax.find({ tenant_id: tenantId }).lean(),
      Category.find({ tenant_id: tenantId }).lean(),
    ]);

    const taxMap = new Map(taxes.map((t) => [t.id, t]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.title]));

    return items.map((i) => {
      const tax = i.tax_id ? taxMap.get(i.tax_id) : null;
      return {
        id: i.id,
        title: i.title,
        description: i.description,
        price: i.price,
        net_price: i.net_price,
        tax_id: i.tax_id,
        tax_title: tax?.title || null,
        tax_rate: tax?.rate || null,
        tax_type: tax?.type || null,
        category_id: i.category,
        category_title: i.category ? categoryMap.get(i.category) || null : null,
        image: i.image,
        is_enabled: i.is_enabled,
      };
    });
  } catch (error) {
    console.error("getAllMenuItemsDB Error:", error);
    throw error;
  }
};

exports.getMenuItemDB = async (id, tenantId) => {
  try {
    const item = await MenuItem.findOne({ id, tenant_id: tenantId }).lean();
    if (!item) return null;

    const [tax, category] = await Promise.all([
      item.tax_id ? Tax.findOne({ id: item.tax_id, tenant_id: tenantId }).lean() : null,
      item.category ? Category.findOne({ id: item.category, tenant_id: tenantId }).lean() : null,
    ]);

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      net_price: item.net_price,
      tax_id: item.tax_id,
      tax_title: tax?.title || null,
      tax_rate: tax?.rate || null,
      tax_type: tax?.type || null,
      category_id: item.category,
      category_title: category?.title || null,
      image: item.image,
      is_enabled: item.is_enabled,
    };
  } catch (error) {
    console.error("getMenuItemDB Error:", error);
    throw error;
  }
};

exports.addMenuItemAddonDB = async (itemId, title, price, tenantId) => {
  try {
    const addon = await MenuItemAddon.create({
      item_id: itemId,
      title,
      price: Number(price || 0),
      tenant_id: tenantId,
    });
    return addon.id;
  } catch (error) {
    console.error("addMenuItemAddonDB Error:", error);
    throw error;
  }
};

exports.updateMenuItemAddonDB = async (itemId, addonId, title, price, tenantId) => {
  try {
    await MenuItemAddon.updateOne(
      { id: addonId, item_id: itemId, tenant_id: tenantId },
      { $set: { title, price: Number(price || 0) } }
    );
  } catch (error) {
    console.error("updateMenuItemAddonDB Error:", error);
    throw error;
  }
};

exports.deleteMenuItemAddonDB = async (itemId, addonId, tenantId) => {
  try {
    await MenuItemAddon.deleteOne({ id: addonId, item_id: itemId, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteMenuItemAddonDB Error:", error);
    throw error;
  }
};

exports.getMenuItemAddonsDB = async (itemId, tenantId) => {
  try {
    return await MenuItemAddon.find({ item_id: itemId, tenant_id: tenantId })
      .select("id item_id title price")
      .lean();
  } catch (error) {
    console.error("getMenuItemAddonsDB Error:", error);
    throw error;
  }
};

exports.getAllAddonsDB = async (tenantId) => {
  try {
    return await MenuItemAddon.find({ tenant_id: tenantId })
      .select("id item_id title price")
      .lean();
  } catch (error) {
    console.error("getAllAddonsDB Error:", error);
    throw error;
  }
};

exports.addMenuItemVariantDB = async (itemId, title, price, tenantId) => {
  try {
    const variant = await MenuItemVariant.create({
      item_id: itemId,
      title,
      price: Number(price || 0),
      tenant_id: tenantId,
    });
    return variant.id;
  } catch (error) {
    console.error("addMenuItemVariantDB Error:", error);
    throw error;
  }
};

exports.updateMenuItemVariantDB = async (itemId, variantId, title, price, tenantId) => {
  try {
    await MenuItemVariant.updateOne(
      { id: variantId, item_id: itemId, tenant_id: tenantId },
      { $set: { title, price: Number(price || 0) } }
    );
  } catch (error) {
    console.error("updateMenuItemVariantDB Error:", error);
    throw error;
  }
};

exports.deleteMenuItemVariantDB = async (itemId, variantId, tenantId) => {
  try {
    await MenuItemVariant.deleteOne({ id: variantId, item_id: itemId, tenant_id: tenantId });
  } catch (error) {
    console.error("deleteMenuItemVariantDB Error:", error);
    throw error;
  }
};

exports.getMenuItemVariantsDB = async (itemId, tenantId) => {
  try {
    return await MenuItemVariant.find({ item_id: itemId, tenant_id: tenantId })
      .select("id item_id title price")
      .lean();
  } catch (error) {
    console.error("getMenuItemVariantsDB Error:", error);
    throw error;
  }
};

exports.getAllVariantsDB = async (tenantId) => {
  try {
    return await MenuItemVariant.find({ tenant_id: tenantId })
      .select("id item_id title price")
      .lean();
  } catch (error) {
    console.error("getAllVariantsDB Error:", error);
    throw error;
  }
};

exports.addRecipeItemDB = async (menuItemId, variantId, addonId, ingredientId, quantity, tenantId) => {
  try {
    const recipe = await MenuItemRecipe.create({
      menu_item_id: menuItemId,
      variant_id: variantId || 0,
      addon_id: addonId || 0,
      inventory_item_id: ingredientId,
      quantity: Number(quantity || 0),
      tenant_id: tenantId,
    });
    return recipe.id;
  } catch (error) {
    console.error("addRecipeItemDB Error:", error);
    throw error;
  }
};

exports.updateRecipeItemDB = async (recipeItemId, menuItemId, variantId, addonId, ingredientId, quantity, tenantId) => {
  try {
    await MenuItemRecipe.updateOne(
      { id: recipeItemId, tenant_id: tenantId },
      {
        $set: {
          menu_item_id: menuItemId,
          variant_id: variantId || 0,
          addon_id: addonId || 0,
          inventory_item_id: ingredientId,
          quantity: Number(quantity || 0),
          updated_at: new Date(),
        },
      }
    );
  } catch (error) {
    console.error("updateRecipeItemDB Error:", error);
    throw error;
  }
};

exports.getRecipeItemsDB = async (menuItemId, tenantId) => {
  try {
    const recipes = await MenuItemRecipe.find({ menu_item_id: menuItemId, tenant_id: tenantId }).lean();
    if (recipes.length === 0) return [];

    const [menuItems, variants, addons, invItems] = await Promise.all([
      MenuItem.find({ id: menuItemId, tenant_id: tenantId }).select("id title").lean(),
      MenuItemVariant.find({ item_id: menuItemId, tenant_id: tenantId }).select("id title").lean(),
      MenuItemAddon.find({ item_id: menuItemId, tenant_id: tenantId }).select("id title").lean(),
      InventoryItem.find({ tenant_id: tenantId }).select("id title unit").lean(),
    ]);

    const menuMap = new Map(menuItems.map((m) => [m.id, m.title]));
    const variantMap = new Map(variants.map((v) => [v.id, v.title]));
    const addonMap = new Map(addons.map((a) => [a.id, a.title]));
    const invMap = new Map(invItems.map((i) => [i.id, i]));

    return recipes.map((r) => {
      const inv = invMap.get(r.inventory_item_id);
      return {
        id: r.id,
        menu_item_id: r.menu_item_id,
        variant_id: r.variant_id,
        addon_id: r.addon_id,
        inventory_item_id: r.inventory_item_id,
        menu_item_title: menuMap.get(r.menu_item_id) || "",
        variant_title: r.variant_id ? variantMap.get(r.variant_id) || null : null,
        addon_title: r.addon_id ? addonMap.get(r.addon_id) || null : null,
        ingredient_title: inv?.title || "",
        unit: inv?.unit || "",
        quantity: r.quantity,
      };
    });
  } catch (error) {
    console.error("getRecipeItemsDB Error:", error);
    throw error;
  }
};

exports.getAllRecipeItemsDB = async (tenantId) => {
  try {
    const recipes = await MenuItemRecipe.find({ tenant_id: tenantId }).lean();
    if (recipes.length === 0) return [];

    const itemIds = [...new Set(recipes.map((r) => r.menu_item_id))];
    const invIds = [...new Set(recipes.map((r) => r.inventory_item_id))];

    const [menuItems, variants, addons, invItems] = await Promise.all([
      MenuItem.find({ id: { $in: itemIds }, tenant_id: tenantId }).select("id title").lean(),
      MenuItemVariant.find({ item_id: { $in: itemIds }, tenant_id: tenantId }).select("id title").lean(),
      MenuItemAddon.find({ item_id: { $in: itemIds }, tenant_id: tenantId }).select("id title").lean(),
      InventoryItem.find({ id: { $in: invIds }, tenant_id: tenantId }).select("id title unit quantity min_quantity_threshold").lean(),
    ]);

    const menuMap = new Map(menuItems.map((m) => [m.id, m.title]));
    const variantMap = new Map(variants.map((v) => [v.id, v.title]));
    const addonMap = new Map(addons.map((a) => [a.id, a.title]));
    const invMap = new Map(invItems.map((i) => [i.id, i]));

    return recipes.map((r) => {
      const inv = invMap.get(r.inventory_item_id);
      return {
        id: r.id,
        menu_item_id: r.menu_item_id,
        variant_id: r.variant_id,
        addon_id: r.addon_id,
        inventory_item_id: r.inventory_item_id,
        menu_item_title: menuMap.get(r.menu_item_id) || "",
        variant_title: r.variant_id ? variantMap.get(r.variant_id) || null : null,
        addon_title: r.addon_id ? addonMap.get(r.addon_id) || null : null,
        ingredient_title: inv?.title || "",
        unit: inv?.unit || "",
        current_quantity: inv?.quantity || 0,
        min_quantity_threshold: inv?.min_quantity_threshold || 0,
        recipe_quantity: r.quantity,
      };
    });
  } catch (error) {
    console.error("getAllRecipeItemsDB Error:", error);
    throw error;
  }
};

exports.deleteRecipeItemDB = async (itemId, recipeItemId, variant, addon, tenantId) => {
  try {
    const query = {
      menu_item_id: itemId,
      id: recipeItemId,
      tenant_id: tenantId,
    };
    if (variant) query.variant_id = variant;
    if (addon) query.addon_id = addon;

    await MenuItemRecipe.deleteOne(query);
  } catch (error) {
    console.error("deleteRecipeItemDB Error:", error);
    throw error;
  }
};
