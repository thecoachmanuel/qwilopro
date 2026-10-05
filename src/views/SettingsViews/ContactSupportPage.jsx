import React, { useEffect, useState } from 'react';
import Page from "../../components/Page";
import { IconBrandGmail, IconCopy, IconMail, IconX } from "@tabler/icons-react";
import { iconStroke, supportEmail } from "../../config/config";
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import { useTheme } from '../../contexts/ThemeContext';
import apiClient from '../../helpers/ApiClient';

export default function ContactSupportPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(supportEmail);
  const { theme } = useTheme();

  useEffect(() => {
    apiClient.get("/settings/contact-email")
      .then(res => {
        if (res.data?.email) {
          setEmail(res.data.email);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Page className="p-4 sm:p-6 max-w-4xl">
      <h3 className="text-xl sm:text-2xl font-bold">{t("contact_support.title")}</h3>

      <div className='mt-6 w-full rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 justify-between border border-restro-border-green bg-restro-gray'>
        <div className='flex-1'>
          <p className='text-xl sm:text-2xl font-semibold'>
            {t("contact_support.need_help")}
          </p>
          <p className="text-sm sm:text-base font-normal mt-1 text-restro-text" dangerouslySetInnerHTML={{ __html: t("contact_support.description", { email }) }} />
        </div>

        <button
          onClick={() => {
            const modal = document.getElementById("mailto");
            if (modal) modal.showModal();
          }}
          className='w-full sm:w-auto flex items-center gap-2 justify-center rounded-full px-5 py-3 text-white bg-restro-green hover:bg-restro-green-button-hover active:scale-95 transition text-sm sm:text-base font-medium break-all'
        >
          <IconMail stroke={iconStroke} size={20} className="shrink-0" />
          <span className="truncate">{email}</span>
        </button>
      </div>

      <dialog id="mailto" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl max-w-md w-full p-5 sm:p-6'>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t("contact_support.send_mail")}</h3>
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
                toast.success(t("contact_support.copied_to_clipboard"));
              }
            }} className='btn bg-gray-600 hover:bg-gray-700 text-white text-sm'><IconCopy stroke={iconStroke} size={18} />{t("contact_support.copy")}</button>
          </div>

          <div className="border-b border-base-200 my-5"></div>

          <p className='text-center text-sm font-medium mb-3'>{t("contact_support.or_open_with")}</p>

          <a href={`mailto:${email}`} className='flex items-center gap-3 transition active:scale-95 bg-gray-100 dark:bg-restro-gray hover:bg-gray-200 dark:hover:bg-restro-button-hover px-4 rounded-xl py-3 text-sm text-restro-text font-medium'>
            <IconMail stroke={iconStroke} size={20} />{t("contact_support.default_mail_app")}
          </a>

          <a target='_blank' rel="noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=&cc=&bcc=&body=`} className='flex items-center gap-3 transition active:scale-95 bg-gray-100 dark:bg-restro-gray hover:bg-gray-200 dark:hover:bg-restro-button-hover px-4 rounded-xl py-3 text-sm text-restro-text font-medium mt-2'>
            <IconBrandGmail stroke={iconStroke} size={20} />{t("contact_support.gmail_in_browser")}
          </a>
        </div>
      </dialog>
    </Page>
  );
}
