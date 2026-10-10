import React, { useMemo, memo } from 'react';
import { getImageURL } from '../helpers/ImageHelper';
import { IconAlertTriangleFilled, IconCarrot, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useTheme } from '../contexts/ThemeContext';
import { iconStroke } from '../config/config';

const CompactMenuItemCard = memo(function CompactMenuItemCard({
  menuItem,
  currency,
  t,
  btnOpenVariantAndAddonModal,
  addItemToCart,
}) {
  const { title, id, price, image, category_title, addons, variants } = menuItem;

  const imageURL = image ? getImageURL(image) : null;
  const hasVariantOrAddon = variants?.length > 0 || addons?.length > 0;

  const baseRecipeItems = (menuItem.recipeItems || []).filter(
    (r) => r.variant_id === 0 && r.addon_id === 0
  );

  const isLowStock = baseRecipeItems.some(
    (r) => parseFloat(r.current_quantity) <= parseFloat(r.min_quantity_threshold)
  );

  const quantitiesPossible = baseRecipeItems.map((r) => {
    const currentQty = parseFloat(r.current_quantity || "0");
    const requiredQty = parseFloat(r.recipe_quantity || "1");
    return Math.floor(currentQty / requiredQty);
  });

  const minItemsCanBeMade = quantitiesPossible.length > 0
    ? Math.min(...quantitiesPossible)
    : null;

  return (
    <div
      className='flex flex-col gap-2 h-44 hover:cursor-pointer overflow-hidden border rounded-2xl border-restro-border-green'
      onClick={() => {
        if (hasVariantOrAddon) {
          btnOpenVariantAndAddonModal(id);
        } else {
          addItemToCart(menuItem);
        }
      }}
    >
      <div>
        <div className='flex items-center justify-center relative w-full flex-shrink-0 h-28 rounded-t-2xl text-restro-text bg-restro-gray border-restro-green-light'>
          {image ? (
            <img
              src={imageURL}
              alt={title}
              loading="lazy"
              decoding="async"
              className="w-full h-full absolute top-0 left-0 rounded-t-2xl object-cover"
            />
          ) : (
            <IconCarrot />
          )}
          {category_title && (
            <div className="absolute top-0 left-0 text-white bg-restro-green text-xs font-semibold px-2 py-1 rounded-tl-2xl rounded-br-xl">
              {category_title}
            </div>
          )}
          {isLowStock && (
            <div className="absolute left-0 bottom-0 bg-amber-50 text-amber-600 text-[10px] font-medium px-1 py-[1px] z-10 w-full flex flex-col items-center gap-[2px]">
              <div className="flex items-center gap-1">
                <IconAlertTriangleFilled size={12} />
                <span>Low Stock - {minItemsCanBeMade} Qty</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-2 pb-2 flex flex-col w-full flex-grow">
        <div className='text-left flex-grow'>
          <p className='line-clamp-1 text-ellipsis text-sm font-semibold'>{title}</p>
        </div>
        <div className='flex items-center justify-between mt-1'>
          <p className='text-left text-restro-green font-bold text-sm'>{currency}{price}</p>
          <button
            type="button"
            title={hasVariantOrAddon ? t("pos_menu.variants") : t("pos_menu.add")}
            onClick={(e) => {
              e.stopPropagation();
              if (hasVariantOrAddon) {
                btnOpenVariantAndAddonModal(id);
              } else {
                addItemToCart(menuItem);
              }
            }}
            className='w-7 h-7 rounded-lg flex items-center justify-center bg-restro-green hover:bg-restro-green-button-hover text-white transition active:scale-95 shadow-sm'
          >
            <IconPlus size={16} stroke={iconStroke || 2} />
          </button>
        </div>
      </div>
    </div>
  );
});

const POSMenuItemCompactView = ({
  menuItems,
  selectedCategory,
  categories,
  searchQuery,
  currency,
  btnOpenVariantAndAddonModal,
  addItemToCart,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const safeMenuItems = Array.isArray(menuItems) ? menuItems : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const enabledCategoryIds = useMemo(() => {
    return new Set(
      safeCategories
        .filter((c) => c && c.is_enabled)
        .map((c) => c.id)
    );
  }, [safeCategories]);

  const cleanQuery = useMemo(() => (searchQuery || "").trim().toLowerCase(), [searchQuery]);

  const filteredMenuItems = useMemo(() => {
    return safeMenuItems
      .filter((menuItem) => menuItem && menuItem.is_enabled)
      .filter((menuItem) => {
        if (selectedCategory === "all") {
          return !menuItem.category_id || enabledCategoryIds.has(menuItem.category_id);
        }
        return selectedCategory === menuItem.category_id;
      })
      .filter((menuItem) => {
        if (!cleanQuery) return true;
        return (menuItem.title || "").toLowerCase().includes(cleanQuery);
      });
  }, [safeMenuItems, selectedCategory, enabledCategoryIds, cleanQuery]);

  return (
    <div className='w-full h-full overflow-hidden'>
      {filteredMenuItems.length === 0 ? (
        <div className="flex flex-col justify-center items-center w-full h-full rounded-2xl">
          <img
            src="/assets/illustrations/pos-not-found.webp"
            alt={t('pos.not_found_img_alt')}
            className="w-1/4 mb-4"
            loading="lazy"
          />
          <p className="text-lg text-restro-green font-bold">{t("pos_menu.not_found_title")}</p>
          <p className="text-gray-500">{t("pos_menu.not_found_message")}</p>
          <p className="text-gray-500">{t("pos_menu.not_found_carrot")}</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full z-0 px-4 pb-4 rounded-b-2xl overflow-y-auto h-full content-start'>
          {filteredMenuItems.map((menuItem) => (
            <CompactMenuItemCard
              key={menuItem.id}
              menuItem={menuItem}
              currency={currency}
              t={t}
              btnOpenVariantAndAddonModal={btnOpenVariantAndAddonModal}
              addItemToCart={addItemToCart}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(POSMenuItemCompactView);
