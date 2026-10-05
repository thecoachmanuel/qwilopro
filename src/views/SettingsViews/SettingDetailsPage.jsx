import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Page from "../../components/Page";
import { CURRENCIES } from "../../config/currencies.config";
import {
  saveStoreSettings,
  useStoreSettings,
  uploadStoreImage,
  deleteStoreImage,
} from "../../controllers/settings.controller";
import { toast } from "react-hot-toast";
import { mutate } from "swr";
import Popover from "../../components/Popover";
import {
  IconExternalLink,
  IconLock,
  IconQrcode,
  IconTrash,
  IconUpload,
  IconWorld,
} from "@tabler/icons-react";
import { iconStroke } from "../../config/config";
import QRCode from "qrcode";
import { getQRMenuLink } from "../../helpers/QRMenuHelper";
import imageCompression from "browser-image-compression";
import { getImageURL } from "../../helpers/ImageHelper";
import { useTheme } from "../../contexts/ThemeContext";
import { getUserDetailsInLocalStorage } from "../../helpers/UserDetails";
import { PLAN_FEATURES } from "../../config/scopes";

export default function SettingDetailsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const storeNameRef = useRef();
  const addressRef = useRef();
  const emailRef = useRef();
  const phoneRef = useRef();
  const currencyRef = useRef();
  const isQRMenuEnabledRef = useRef();
  const isQROrderEnabledRef = useRef();
  const isFeedbackEnabledRef = useRef();
  const customDomainRef = useRef();
  const { theme } = useTheme();
  const user = getUserDetailsInLocalStorage();
  const rawFeatures = user?.planFeatures || user?.planFeautures || user?.plan_features || user?.features;
  const userPlanFeatures = Array.isArray(rawFeatures)
    ? rawFeatures.map(f => String(f).toUpperCase())
    : (typeof rawFeatures === 'string' ? rawFeatures.split(",").map(f => f.trim().toUpperCase()) : []);

  const isQrMenuAccess = user?.role === "admin" || userPlanFeatures.includes(PLAN_FEATURES?.QRMENU || 'QRMENU');
  const isCustomDomainAccess =
    user?.role === "admin" ||
    userPlanFeatures.includes(PLAN_FEATURES?.CUSTOM_DOMAIN || "CUSTOM_DOMAIN") ||
    userPlanFeatures.includes("CUSTOM_DOMAIN") ||
    (user?.plan_title && String(user.plan_title).toLowerCase().includes("business"));

  const { APIURL, data, error, isLoading } = useStoreSettings();

  if (isLoading) {
    return <Page className="px-8 py-6">{t("settings.please_wait")}</Page>;
  }

  if (error) {
    console.error(error);
    return (
      <Page className="px-8 py-6">{t("settings.error_loading_data")}</Page>
    );
  }

  const {
    storeImage,
    storeName,
    email,
    address,
    phone,
    currency,
    isQRMenuEnabled,
    uniqueQRCode,
    slug,
    custom_domain,
    isQROrderEnabled,
    isFeedbackEnabled,
    uniqueId,
  } = data || {};

  const storeSlug = slug || (storeName ? storeName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') : null);
  const QR_MENU_LINK = getQRMenuLink(uniqueQRCode, storeSlug);

  const btnSave = async () => {
    const storeName = storeNameRef.current.value;
    const address = addressRef.current.value;
    const email = emailRef.current.value;
    const phone = phoneRef.current.value;
    const currency = currencyRef.current.value;
    const isQRMenuEnabled = isQRMenuEnabledRef.current.checked;
    const isQROrderEnabled = isQROrderEnabledRef.current.checked;
    const isFeedbackEnabled = isFeedbackEnabledRef.current.checked;
    const customDomainVal = customDomainRef.current ? customDomainRef.current.value : (custom_domain || null);

    try {
      toast.loading(t("settings.please_wait"));
      const res = await saveStoreSettings(
        storeName,
        address,
        phone,
        email,
        currency,
        null,
        isQRMenuEnabled,
        isQROrderEnabled,
        isFeedbackEnabled,
        storeSlug,
        customDomainVal
      );

      if (res.status == 200) {
        await mutate(APIURL);
        toast.dismiss();
        toast.success(res.data.message);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message || t("settings.something_went_wrong");
      console.error(error);

      toast.dismiss();
      toast.error(message);
    }
  };

  const btnDownloadMenuQR = async () => {
    try {
      if (!uniqueQRCode) {
        toast.error("QR code not configured. Please save your store settings first.");
        return;
      }
      const qrDataURL = await QRCode.toDataURL(QR_MENU_LINK, { width: 1080, margin: 2 });
      const link = document.createElement("a");
      const safeName = (storeName || 'qr').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${safeName}-menu-qr.png`;
      link.href = qrDataURL;
      link.click();
      link.remove();
      toast.success("QR code downloaded!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate QR code.");
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    // compress image
    try {
      toast.loading(t("settings.please_wait"));
      const compressedImage = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const formData = new FormData();
      formData.append("store_image", compressedImage);

      const res = await uploadStoreImage(formData);
      if (res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message);

        // update the image state
        const imagePath = res.data.imageURL;
        await mutate(APIURL);
        location.reload();
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message =
        error?.response?.data?.message || t("settings.something_went_wrong");
      toast.error(message);
    }
  };

  const handleFileDelete = async () => {
    try {
      toast.loading(t("settings.please_wait"));

      console.log(uniqueId);

      const res = await deleteStoreImage(uniqueId);
      if (res.status == 200) {
        toast.dismiss();
        toast.success(res.data.message);
        await mutate(APIURL);
        location.reload();
      }
    } catch (error) {
      console.error(error);
      toast.dismiss();
      const message =
        error?.response?.data?.message || t("settings.something_went_wrong");
      toast.error(message);
    }
  };

  const handleToggleChange = (e, toggleType) => {
    if (!isQrMenuAccess) {
      e.target.checked = !e.target.checked;
      document.getElementById("modal-upgrade-required").showModal();
    }
  };

  const handleUpgradeClick = () => {
    document.getElementById("modal-upgrade-required").close();
    navigate("/dashboard/profile");
  };

  return (
    <Page className="px-8 py-6">
      <h3 className="text-3xl font-light">{t("settings.store_details")}</h3>

      <div className="mt-8 text-sm text-gray-500">
        {/* Store Image Upload Section */}
        <div className="mb-6">
          <label htmlFor="storeImage" className="block mb-1 font-medium">
            {t("settings.store_image")}
          </label>
          <div className="flex flex-col items-start gap-2">
            <input
              type="file"
              name="storeImage"
              id="storeImage"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-24 h-24 rounded-xl flex items-center justify-center relative border border-restro-border-green">
              {storeImage ? (
                <img
                  src={getImageURL(storeImage)}
                  alt="Store"
                  className="object-cover w-24 h-24 rounded-xl bg-gray-50"
                />
              ) : (
                <span className="text-gray-400 text-sm">
                  {t("settings.no_image")}
                </span>
              )}

              {!storeImage ? (
                <label
                  htmlFor="storeImage"
                  className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 bg-restro-gray p-1 rounded-full shadow cursor-pointer hover:bg-restro-button-hover z-10 border border-restro-border-green text-restro-text"
                >
                  <IconUpload size={14} stroke={iconStroke} />
                </label>
              ) : (
                <button
                  className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 bg-restro-gray p-1 rounded-full shadow cursor-pointer hover:bg-restro-red-hover z-10 text-restro-red"
                  onClick={handleFileDelete}
                >
                  <IconTrash size={14} stroke={iconStroke} />
                </button>
              )}
            </div>
            {/* <p className="text-xs text-gray-400">
              Supported formats: JPG, PNG. Max size: 5MB.
            </p> */}
          </div>
        </div>

        <div>
          <label htmlFor="name" className="block mb-1">
            {t("settings.store_name")}
          </label>
          <input
            ref={storeNameRef}
            type="text"
            name="name"
            id="name"
            defaultValue={storeName}
            placeholder={t("settings.store_name_placeholder")}
            className="block w-full lg:min-w-96 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="address" className="block mb-1">
            {t("settings.address")}
          </label>
          <textarea
            ref={addressRef}
            type="text"
            name="address"
            id="address"
            defaultValue={address}
            placeholder={t("settings.address_placeholder")}
            className="block w-full lg:min-w-96 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="email" className="block mb-1">
            {t("settings.email")}
          </label>
          <input
            ref={emailRef}
            type="email"
            name="email"
            id="email"
            defaultValue={email}
            placeholder={t("settings.email_placeholder")}
            className="block w-full lg:min-w-96 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="phone" className="block mb-1">
            {t("settings.phone")}
          </label>
          <input
            ref={phoneRef}
            type="tel"
            name="phone"
            id="phone"
            defaultValue={phone}
            placeholder={t("settings.phone_placeholder")}
            className="block w-full lg:min-w-96 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="currency" className="block mb-1">
            {t("settings.currency")}
          </label>
          <select
            ref={currencyRef}
            name="currency"
            id="currency"
            defaultValue={currency}
            placeholder={t("settings.select_currency")}
            className="block w-full lg:min-w-96 rounded-lg px-4 py-2 text-restro-text bg-restro-gray border border-restro-border-green focus:outline-restro-button-hover"
          >
            <option value="" hidden>
              {t("settings.select_currency")}
            </option>
            {CURRENCIES.map((item, index) => {
              return (
                <option value={item.cc} key={index}>
                  {item.name} - ({item.symbol})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <div className="w-full lg:min-w-96 flex items-center justify-between mt-4">
            <label htmlFor="qrmenu" className="flex items-center gap-2">
              {t("settings.enable_qr_menu")}
              <Popover text={t("settings.qr_menu_tooltip")} />
            </label>
            {/* switch */}
            <label className="relative inline-flex items-center cursor-pointer no-drag">
              <input
                ref={isQRMenuEnabledRef}
                defaultChecked={isQRMenuEnabled}
                type="checkbox"
                name="qrmenu"
                id="qrmenu"
                value=""
                className="sr-only peer"
                onChange={(e) => handleToggleChange(e, "qrmenu")}
              />
              <div
                className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full  after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green`}
              ></div>
            </label>
            {/* switch */}
          </div>
          {isQRMenuEnabled && isQrMenuAccess && (
            <div className="mt-4 flex flex-col lg:flex-row gap-4">
              <button
                onClick={btnDownloadMenuQR}
                className="btn btn-sm transition-colors rounded-xl bg-restro-gray hover:bg-restro-button-hover"
              >
                <IconQrcode stroke={iconStroke} />{" "}
                {t("settings.download_qr_code")}
              </button>
              <a
                target="_blank"
                href={QR_MENU_LINK}
                className="btn btn-sm transition-colors rounded-xl bg-restro-gray hover:bg-restro-button-hover"
              >
                <IconExternalLink stroke={iconStroke} />{" "}
                {t("settings.view_digital_menu")}
              </a>
            </div>
          )}
          <div className="w-full lg:min-w-96 flex items-center justify-between mt-4">
            <label htmlFor="qrorder" className="flex items-center gap-2">
              {t("settings.enable_qr_order")}
              <Popover text={t("settings.qr_order_tooltip")} />
            </label>
            {/* switch */}
            <label className="relative inline-flex items-center cursor-pointer no-drag">
              <input
                ref={isQROrderEnabledRef}
                defaultChecked={isQROrderEnabled}
                type="checkbox"
                name="qrorder"
                id="qrorder"
                value=""
                className="sr-only peer"
                onChange={(e) => handleToggleChange(e, "qrorder")}
              />
              <div
                className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full  after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green`}
              ></div>
            </label>
            {/* switch */}
          </div>
          <div className="w-full lg:min-w-96 flex items-center justify-between mt-4">
            <label htmlFor="feedback" className="flex items-center gap-2">
              {t("settings.enable_feedback")}
              <Popover text={t("settings.feedback_tooltip")} />
            </label>
            {/* switch */}
            <label className="relative inline-flex items-center cursor-pointer no-drag">
              <input
                ref={isFeedbackEnabledRef}
                defaultChecked={isFeedbackEnabled}
                type="checkbox"
                name="feedback"
                id="feedback"
                value=""
                className="sr-only peer"
                onChange={(e) => handleToggleChange(e, "feedback")}
              />
              <div
                className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full  after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-100 after:border-restro-bg-gray after:border after:rounded-full after:h-5 after:w-5 after:transition-all bg-restro-checkbox peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-restro-ring-light peer-checked:bg-restro-green peer-checked:after:border-restro-border-green`}
              ></div>
            </label>
            {/* switch */}
          </div>
        </div>

        {/* Custom Domain Section (Business Plan) */}
        <div className="mt-8 pt-6 border-t border-restro-border-green w-full lg:min-w-96">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="custom_domain" className="flex items-center gap-2 font-semibold text-base text-restro-text">
              <IconWorld size={20} stroke={iconStroke} className="text-restro-green" />
              Custom Domain (White-Label)
              <Popover text="Connect your custom branded domain or subdomain (e.g. order.myrestaurant.com) to your digital storefront." />
            </label>
            {isCustomDomainAccess ? (
              <span className="badge badge-success text-xs font-bold text-white px-3 py-2">
                Business Feature Active
              </span>
            ) : (
              <span className="badge badge-warning text-xs font-bold px-3 py-2 flex items-center gap-1">
                <IconLock size={12} stroke={iconStroke} />
                Business Plan Only
              </span>
            )}
          </div>
          <p className="text-xs text-restro-text-light mb-3">
            Serve your digital menu and QR ordering directly on your custom domain without any QwiloPRO platform branding.
          </p>
          <div className="relative">
            <input
              ref={customDomainRef}
              type="text"
              name="custom_domain"
              id="custom_domain"
              defaultValue={custom_domain || ""}
              disabled={!isCustomDomainAccess}
              placeholder="e.g. order.myrestaurant.com"
              className={`block w-full lg:min-w-96 rounded-lg px-4 py-2 text-restro-text border ${
                isCustomDomainAccess
                  ? "bg-restro-gray border-restro-border-green focus:outline-restro-button-hover"
                  : "bg-gray-100 dark:bg-zinc-900 border-gray-300 dark:border-zinc-800 opacity-60 cursor-not-allowed"
              }`}
            />
          </div>

          {isCustomDomainAccess ? (
            <div className="mt-3 p-3 rounded-xl bg-restro-card-bg border border-restro-border-green text-xs text-restro-text space-y-1.5">
              <div className="font-semibold text-restro-green flex items-center gap-1">
                <span>DNS Configuration Instructions:</span>
              </div>
              <p>
                Create a <strong>CNAME</strong> record in your domain host DNS provider (Cloudflare, Namecheap, GoDaddy):
              </p>
              <div className="font-mono bg-restro-gray px-3 py-1.5 rounded-lg text-xs break-all">
                Host: <span className="font-bold text-restro-green">order</span> (or your subdomain) &rarr; Target: <span className="font-bold text-restro-green">cname.qwilopro.com</span>
              </div>
              {custom_domain && (
                <div className="pt-1 flex items-center gap-2">
                  <span>Storefront Live Link:</span>
                  <a
                    href={`https://${custom_domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-restro-green font-semibold underline flex items-center gap-1 hover:opacity-80"
                  >
                    https://{custom_domain} <IconExternalLink size={14} stroke={iconStroke} />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
              <span>Upgrade to the Business Plan to unlock custom domains and fully white-label your storefront.</span>
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="btn btn-xs rounded-lg bg-restro-green text-white hover:bg-restro-green-button-hover whitespace-nowrap"
              >
                Upgrade to Business Plan
              </button>
            </div>
          )}
        </div>

        <button
          onClick={btnSave}
          className="text-white w-full lg:min-w-96 transition  active:scale-95 rounded-xl px-4 py-2 mt-6 bg-restro-green hover:bg-restro-green-button-hover "
        >
          {t("settings.save")}
        </button>
      </div>

      {/* Upgrade Required Dialog */}
      <dialog
        id="modal-upgrade-required"
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box border border-restro-border-green dark:rounded-2xl">
          <h3 className="font-bold text-lg">
            {t("settings.upgread.upgrade_required")}
          </h3>
          <p className="py-4">{t("settings.upgread.upgrade_message")}</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn transition active:scale-95 hover:shadow-lg px-4 py-3 rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover text-restro-text">
                {t("settings.upgread.close")}
              </button>
            </form>
            <button
              onClick={handleUpgradeClick}
              className="btn rounded-xl transition active:scale-95 hover:shadow-lg px-4 py-3 text-white ml-3 border border-restro-border-green bg-restro-green hover:bg-restro-green-button-hover"
            >
              {t("settings.upgread.upgrade_button")}
            </button>
          </div>
        </div>
      </dialog>
    </Page>
  );
}
