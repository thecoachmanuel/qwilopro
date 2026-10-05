import React, { useEffect, useState } from 'react';
import Page from "../../components/Page";
import { IconBrandGmail, IconCheck, IconCopy, IconDeviceFloppy, IconMail, IconX } from "@tabler/icons-react";
import { iconStroke, supportEmail } from "../../config/config";
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import { useTheme } from '../../contexts/ThemeContext';
import apiClient from '../../helpers/ApiClient';

export default function SuperAdminContactSupportPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(supportEmail);
  const [inputEmail, setInputEmail] = useState(supportEmail);
  const [isUpdating, setIsUpdating] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    apiClient.get("/superadmin/contact-email")
      .then(res => {
        if (res.data?.email) {
          setEmail(res.data.email);
          setInputEmail(res.data.email);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateEmail = async (e) => {
    e?.preventDefault();
    if (!inputEmail || !inputEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setIsUpdating(true);
      const res = await apiClient.put("/superadmin/contact-email", { email: inputEmail });
      if (res.data?.success) {
        setEmail(res.data.email);
        toast.success(res.data.message || "Contact email updated successfully!");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update contact email");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Page className="p-4 sm:p-6 max-w-4xl">
      <h3 className="text-xl sm:text-2xl font-bold">{t("superadmin_contact_support.title")}</h3>

      {/* Superadmin configuration card */}
      <div className="mt-6 rounded-2xl p-5 sm:p-6 border border-restro-border-green bg-restro-gray">
        <h4 className="text-lg font-bold mb-2">Configure Platform Support Email</h4>
        <p className="text-xs sm:text-sm text-restro-text mb-4">
          This email address is displayed to all tenants and restaurant owners when they need platform assistance.
        </p>

        <form onSubmit={handleUpdateEmail} className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="email"
            required
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            placeholder="support@yourdomain.com"
            className="input input-bordered flex-1 text-sm bg-base-100 rounded-xl"
          />
          <button
            type="submit"
            disabled={isUpdating || inputEmail === email}
            className="btn bg-restro-green hover:bg-restro-green-button-hover text-white rounded-xl px-5 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isUpdating ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <IconDeviceFloppy stroke={iconStroke} size={18} />
            )}
            Save Changes
          </button>
        </form>
      </div>

      {/* Preview card (same as what tenants see) */}
      <div className="mt-6 w-full rounded-2xl p-4 sm:p-6 border border-restro-bg-gray flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 justify-between">
        <div className="flex-1">
          <p className='text-xl sm:text-2xl font-semibold'>
            {t("superadmin_contact_support.need_help")}
          </p>
          <p className="text-sm sm:text-base text-restro-text font-normal mt-1" dangerouslySetInnerHTML={{ __html: t("superadmin_contact_support.description", { email }) }} />
        </div>

        <button
          onClick={() => {
            const modal = document.getElementById("mailto");
            if (modal) modal.showModal();
          }}
          className='w-full sm:w-auto flex items-center gap-2 justify-center rounded-full text-white bg-restro-green hover:bg-restro-green-button-hover active:scale-95 transition px-5 py-3 text-sm sm:text-base font-medium break-all'
        >
          <IconMail stroke={iconStroke} size={20} className="shrink-0" />
          <span className="truncate">{email}</span>
        </button>
      </div>

      <dialog id="mailto" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl max-w-md w-full p-5 sm:p-6'>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t("superadmin_contact_support.send_mail")}</h3>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost"><IconX stroke={iconStroke} size={18} /></button>
            </form>  
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <input type="email" id='mailto_email' readOnly value={email} className='input input-bordered flex-1 text-sm bg-base-200' />
            <button onClick={() => {
              const mailElem = document.getElementById("mailto_email");
              if (mailElem) {
                mailElem.select();
                navigator.clipboard.writeText(mailElem.value);
                toast.success(t("superadmin_contact_support.copied_to_clipboard"));
              }
            }} className='btn bg-gray-500 dark:bg-restro-gray hover:bg-gray-600 dark:hover:bg-restro-button-hover text-white rounded-xl text-sm'><IconCopy stroke={iconStroke} size={18} />{t("superadmin_contact_support.copy")}</button>
          </div>

          <div className="border-b border-base-200 my-5"></div>

          <p className='text-center text-sm font-medium mb-3'>{t("superadmin_contact_support.or_open_with")}</p>

          <a href={`mailto:${email}`} className='flex items-center gap-3 transition active:scale-95 bg-gray-100 hover:bg-gray-200 px-4 rounded-xl py-3 text-sm text-restro-text dark:bg-restro-gray dark:hover:bg-restro-button-hover font-medium'>
            <IconMail stroke={iconStroke} size={20} />{t("superadmin_contact_support.default_mail_app")}
          </a>

          <a target='_blank' rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=&cc=&bcc=&body=`} className='flex items-center gap-3 transition active:scale-95 bg-gray-100 hover:bg-gray-200 dark:bg-restro-gray dark:hover:bg-restro-button-hover px-4 rounded-xl py-3 text-sm text-restro-text font-medium mt-2'>
            <IconBrandGmail stroke={iconStroke} size={20} />{t("superadmin_contact_support.gmail_in_browser")}
          </a>
        </div>
      </dialog>
    </Page>
  );
}
