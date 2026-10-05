import React from 'react'
import Page from "../../components/Page";
import ImgGirlSmiling from "../../assets/girl-smiling.webp";
import Logo from "../../assets/logo.svg";
import { Link } from 'react-router-dom';
import { IconArrowRight, IconInfoCircleFilled } from '@tabler/icons-react';
import { appVersion, iconStroke, subscriptionAmount } from '../../config/config';
import { useSuperAdminDashboard } from "../../controllers/superadmin.controller";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export default function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { data, error, isLoading } = useSuperAdminDashboard();

  if(isLoading) {
    return <Page>
      {t('superadmin_dashboard.please_wait')}
    </Page>
  }

  if(error) {
    console.error(error);

    return <Page>
      {t('superadmin_dashboard.error_loading')}
    </Page>
  }

  const {
    activeTenants, ordersProcessedToday, salesVolumeToday, mrr, arr
  } = data;

  const nairaRate = 0.00074; // 1 USD = 1350 NGN
  const mrrValue = data.mrrUsd ?? (mrr * subscriptionAmount);
  const arrValue = data.arrUsd ?? (arr * subscriptionAmount * 12);

  const mrrNgn = data.mrrNgn ?? Math.round(mrrValue / nairaRate);
  const arrNgn = data.arrNgn ?? Math.round(arrValue / nairaRate);
  const salesVolumeNgn = data.salesVolumeTodayNgn ?? Math.round((salesVolumeToday || 0) / nairaRate);
  const salesVolumeUsd = data.salesVolumeTodayUsd ?? salesVolumeToday ?? 0;

  return (
    <Page className='px-4 py-3 overflow-x-hidden h-full'>
      <h3 className="text-2xl mt-2">{t('superadmin_dashboard.title')}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">

        <div className='md:row-span-3 bg-restro-superadmin-widget-bg rounded-[42px]'>
          <p className='text-restro-superadmin-text-green font-bold text-center mt-4'>{t('superadmin_dashboard.active_tenants')}</p>
          <p className='text-white font-black text-7xl text-center'>{Number(activeTenants).toLocaleString("en", {
            notation: "compact"
          })}</p>
          <img src={ImgGirlSmiling?.src || ImgGirlSmiling} alt="img" className='block h-96 mx-auto mt-10' />
        </div>

        <div className='rounded-[42px] border px-8 py-5 flex flex-col justify-center border-restro-border-green'>
          <div className="flex items-center justify-between">
            <p className='font-bold'>{t('superadmin_dashboard.mrr')}</p>
            <span className='badge badge-success badge-sm font-semibold text-white bg-restro-green'>₦ NGN</span>
          </div>
          <p className='font-black text-4xl lg:text-5xl mt-2 text-restro-text'>
            ₦{Number(mrrNgn).toLocaleString('en-NG', { notation: "compact" })}
          </p>
          <p className='text-xs opacity-60 mt-1 font-medium'>
            ≈ ${Number(mrrValue).toLocaleString('en', { notation: "compact" })} USD
          </p>
        </div>

        <div className='rounded-[42px] border px-8 py-5 flex flex-col justify-center border-restro-border-green'>
          <div className="flex items-center justify-between">
            <p className='font-bold'>{t('superadmin_dashboard.arr')}</p>
            <span className='badge badge-success badge-sm font-semibold text-white bg-restro-green'>₦ NGN</span>
          </div>
          <p className='font-black text-4xl lg:text-5xl text-restro-green mt-2'>
            ₦{Number(arrNgn).toLocaleString('en-NG', { notation: "compact" })}
          </p>
          <p className='text-xs opacity-60 mt-1 font-medium'>
            ≈ ${Number(arrValue).toLocaleString('en', { notation: "compact" })} USD
          </p>
        </div>

        <div className='border rounded-[42px] px-8 py-5 flex flex-col justify-center border-restro-border-green'>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <p className='font-bold'>{t('superadmin_dashboard.store_sales')}</p>
              <div className='tooltip cursor-pointer tooltip-top' data-tip={t('superadmin_dashboard.store_sales_info')}>
                <IconInfoCircleFilled size={18} stroke={iconStroke}/>
              </div>
            </div>
            <span className='badge badge-success badge-sm font-semibold text-white bg-restro-green'>₦ NGN</span>
          </div>
          <p className='font-black text-4xl lg:text-5xl mt-2 text-restro-text'>
            ₦{Number(salesVolumeNgn).toLocaleString('en-NG', { notation: "compact" })}
          </p>
          <p className='text-xs opacity-60 mt-1 font-medium'>
            ≈ ${Number(salesVolumeUsd).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
          </p>
        </div>

        <div className='rounded-[42px] border px-8 py-5 flex flex-col justify-center border-restro-border-green'>
          <p className='font-bold'>{t('superadmin_dashboard.orders_processed')}</p>
          <p className='font-black text-5xl mt-2 text-restro-text'>{Number(ordersProcessedToday).toLocaleString("en",{notation: "compact"})}</p>
        </div>

        <Link to="/admin/dashboard/reports" className='flex items-center justify-center gap-2 rounded-[42px] border px-8 py-5 md:col-span-2 transition active:scale-95 font-bold border-restro-border-green hover:bg-restro-button-hover '>
          <p>{t('superadmin_dashboard.view_more')}</p>
          <IconArrowRight stroke={iconStroke} />
        </Link>

      </div>

      <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-4 text-[#A5A5A5]">
        <img src={Logo?.src || Logo} alt="Qwilo Pro" className='block shadow w-12 h-12 rounded-2xl object-contain p-2 bg-white dark:bg-zinc-800' />
        <div className="text-center md:text-left">
          <p className="font-bold text-restro-text">
            Qwilo Pro POS<sup>TM</sup>
          </p>
          <p className="text-xs">
            Powered by Qwilo Pro • Version {appVersion}
          </p>
        </div>
      </div>

    </Page>
  )
}
