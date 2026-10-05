import React, { useState, useEffect, useRef } from "react";
import Page from "../components/Page";
import { IconCamera, IconTrash, IconUser, IconMail, IconPhone, IconShieldLock } from "@tabler/icons-react";
import { getUserDetailsInLocalStorage, saveUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { iconStroke } from "../config/config";
import { getImageURL } from "../helpers/ImageHelper";
import SubscriptionDetails from "../components/SubscriptionDetails";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import ApiClient from "../helpers/ApiClient";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(() => getUserDetailsInLocalStorage() || {});
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setUser(getUserDetailsInLocalStorage() || {});
    };
    window.addEventListener("restro_user_updated", handleUpdate);
    return () => window.removeEventListener("restro_user_updated", handleUpdate);
  }, []);

  const {
    name = "User",
    designation,
    photo = null,
    role = "user",
    username = "",
    email = "",
    phone = "",
  } = user || {};

  const displayDesignation =
    designation ||
    (role === "admin"
      ? t("profile.administrator") || "Restaurant Administrator"
      : role === "superadmin"
      ? "Super Administrator"
      : t("profile.staff") || "Staff Member");

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      toast.loading(t("toast.please_wait") || "Uploading photo...");

      const compressedImage = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const formData = new FormData();
      formData.append("photo", compressedImage);

      const res = await ApiClient.post("/users/profile-photo", formData);
      toast.dismiss();

      if (res.status === 200 && res.data?.success) {
        toast.success(res.data.message || "Profile photo updated!");
        const updatedUser = { ...user, photo: res.data.photo };
        saveUserDetailsInLocalStorage(updatedUser);
        setUser(updatedUser);
      } else {
        toast.error(res.data?.message || t("toast.something_went_wrong"));
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.dismiss();
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm("Are you sure you want to remove your profile photo?")) {
      return;
    }

    try {
      toast.loading(t("toast.please_wait") || "Removing photo...");
      const res = await ApiClient.post("/users/remove-profile-photo");
      toast.dismiss();

      if (res.status === 200 && res.data?.success) {
        toast.success("Profile photo removed!");
        const updatedUser = { ...user, photo: null };
        saveUserDetailsInLocalStorage(updatedUser);
        setUser(updatedUser);
      } else {
        toast.error(res.data?.message || t("toast.something_went_wrong"));
      }
    } catch (error) {
      console.error("Remove photo error:", error);
      toast.dismiss();
      const message = error?.response?.data?.message || t("toast.something_went_wrong");
      toast.error(message);
    }
  };

  return (
    <Page>
      <h3 className="text-center mt-4 text-2xl font-semibold text-restro-text">
        {t("profile.title") || "My Profile"}
      </h3>

      <div className="flex flex-col gap-6 w-full items-center justify-center mt-8 pb-12">
        {/* User Card */}
        <div className="w-full md:w-96 rounded-3xl border border-restro-border-green overflow-hidden shadow-sm bg-restro-card-bg">
          {/* Header Banner */}
          <div className="w-full h-24 pt-6 relative bg-restro-green flex items-center justify-center">
            {/* Avatar container */}
            <div className="absolute -bottom-10 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full relative p-1 bg-white dark:bg-black border-2 border-restro-border-green shadow-md">
                {photo ? (
                  <img
                    src={getImageURL(photo)}
                    alt={name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full flex items-center justify-center text-gray-500 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800">
                    <IconUser size={36} stroke={iconStroke} />
                  </div>
                )}

                {/* Upload action button */}
                <button
                  type="button"
                  title="Upload profile photo"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-restro-green text-white hover:bg-restro-green-button-hover shadow-md transition-transform active:scale-95"
                >
                  <IconCamera size={14} stroke={iconStroke} />
                </button>

                {/* Remove photo button if photo exists */}
                {photo && (
                  <button
                    type="button"
                    title="Remove profile photo"
                    onClick={handleRemovePhoto}
                    className="absolute top-0 right-0 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md transition-transform active:scale-95"
                  >
                    <IconTrash size={12} stroke={iconStroke} />
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Details Body */}
          <div className="px-6 pt-14 pb-6 flex flex-col gap-4 text-center">
            <div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-neutral-100">
                {name}
              </h4>
              <div className="mt-1">
                <span className="badge badge-sm rounded-lg bg-restro-green/10 text-restro-green border-restro-border-green font-medium px-3 py-1">
                  {displayDesignation}
                </span>
              </div>
            </div>

            <div className="mt-2 text-start space-y-3 pt-3 border-t border-restro-border-green text-sm text-restro-text">
              {username && (
                <div className="flex items-center gap-2">
                  <IconShieldLock size={16} stroke={iconStroke} className="text-gray-400" />
                  <span className="font-mono text-xs">{username}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <IconMail size={16} stroke={iconStroke} className="text-gray-400" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2">
                  <IconPhone size={16} stroke={iconStroke} className="text-gray-400" />
                  <span>{phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription details for store owner */}
        {role === "admin" && <SubscriptionDetails />}
      </div>
    </Page>
  );
}
