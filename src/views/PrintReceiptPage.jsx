import React, { useEffect } from 'react';
import { getDetailsForReceiptPrint } from '../helpers/ReceiptHelper';
import { getImageURL } from "../helpers/ImageHelper";
import { useTranslation } from "react-i18next";

export default function PrintReceiptPage() {
  const { t } = useTranslation();
  const receiptDetails = getDetailsForReceiptPrint();

  const {
    cartItems = [],
    deliveryType = 'dinein',
    customerType = 'Walk-in',
    customer,
    tableId,
    currency = '$',
    storeSettings = {},
    printSettings = {},
    itemsTotal = 0,
    taxTotal = 0,
    serviceChargeTotal = 0,
    deliveryFee = 0,
    deliveryAddress,
    payableTotal = 0,
    tokenNo,
    orderId,
    paymentMethod
  } = receiptDetails || {};

  const {
    store_name = 'Store Receipt',
    address = '',
    phone = '',
    email = '',
    store_image: storeImage,
  } = storeSettings || {};

  const {
    page_format = 80,
    header = '',
    footer = '',
    show_notes = 1,
    show_store_details = 1,
    show_customer_details = 1,
    print_token = 1,
  } = printSettings || {};

  const hasStoreDetails = Number(show_store_details) === 1;
  const hasCustomerDetails = Number(show_customer_details) === 1;
  const hasNotes = Number(show_notes) === 1;
  const hasToken = Number(print_token) === 1 && tokenNo;

  const handlePrint = () => {
    window.print();
  };

  if (!receiptDetails) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 font-['Nunito'] text-gray-700 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm">
          <p className="text-4xl mb-3">🧾</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Receipt Data</h2>
          <p className="text-sm text-gray-500 mb-6">No active order was selected for printing.</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6">
      {/* On-screen action bar (hidden during print) */}
      <div className="no-print mb-4 flex items-center gap-3">
        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 text-sm transition"
        >
          <span>🖨️</span> Print Receipt
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border shadow-sm text-sm transition"
        >
          Close
        </button>
      </div>

      {/* Printable Receipt Container */}
      <div
        className="font-sans px-3 py-4 bg-white text-black shadow-lg print:shadow-none print:m-0 text-sm leading-tight"
        style={{ width: `${page_format || 80}mm`, minWidth: '48mm' }}
      >
        <style>{`
          @media print {
            body {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Store Logo & Details */}
        {hasStoreDetails && (
          <div className="text-center mb-2">
            {storeImage && (
              <img
                src={getImageURL(storeImage)}
                className="w-14 h-14 mx-auto object-cover rounded-xl mb-1.5"
                alt={store_name}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <h1 className="font-extrabold text-base uppercase tracking-wide text-black">{store_name}</h1>
            {address && <p className="text-xs text-gray-700 mt-0.5">{address}</p>}
            {(phone || email) && (
              <p className="text-xs text-gray-600 mt-0.5">
                {phone && <span>Tel: {phone}</span>}
                {phone && email && <span> | </span>}
                {email && <span>{email}</span>}
              </p>
            )}
          </div>
        )}

        {header && (
          <div>
            <div className="border-b border-dashed border-gray-400 my-1.5"></div>
            <p className="text-center text-xs font-semibold text-gray-800">{header}</p>
          </div>
        )}

        {/* Customer & Order Metadata */}
        {hasCustomerDetails && (
          <div>
            <div className="border-b border-dashed border-gray-400 my-1.5"></div>
            <div className="flex justify-between text-xs">
              <span className="font-bold">{customerType || 'Customer'}</span>
              <span>{customer?.name || ''}</span>
            </div>
            <div className="flex justify-between text-xs mt-0.5">
              <span>{t("print_receipt.order_type") || "Order Type"}:</span>
              <span className="capitalize font-semibold">{deliveryType}</span>
            </div>
            {deliveryAddress && (
              <p className="text-xs text-gray-700 mt-0.5">Destination: {deliveryAddress}</p>
            )}
          </div>
        )}

        {paymentMethod && (
          <div className="text-xs mt-1">
            <span className="opacity-70">{t("print_receipt.payment_method") || "Payment"}: </span>
            <span className="font-bold">{paymentMethod}</span>
          </div>
        )}

        <div className="border-b border-dashed border-gray-400 my-2"></div>
        <div className="flex justify-between text-xs text-gray-700">
          <span>{t("print_receipt.receipt_no") || "Receipt #"}: {tokenNo || '0'}-{new Date().toISOString().substring(0, 10)}</span>
          {orderId && <span>Order #{orderId}</span>}
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">{new Date().toLocaleString()}</p>

        {/* Items List */}
        <div className="border-b border-dashed border-gray-400 my-2"></div>
        <div className="space-y-2">
          {cartItems?.map((cartItem, index) => {
            const { title, quantity, notes, price, addons, addons_ids, variant } = cartItem;
            return (
              <div key={index} className="w-full">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-black">
                    {title} {variant && <span className="font-normal text-gray-700">- {variant.title}</span>}
                  </p>
                </div>
                {addons_ids?.length > 0 && (
                  <p className="text-[11px] text-gray-600 pl-1">
                    + {addons_ids.map((addonId) => {
                      const addon = addons?.find((a) => a.id == addonId);
                      return addon?.title;
                    }).filter(Boolean).join(", ")}
                  </p>
                )}
                {hasNotes && notes && (
                  <p className="text-[11px] italic text-gray-500 pl-1">Note: {notes}</p>
                )}
                <div className="flex justify-between text-xs mt-0.5">
                  <span className="text-gray-600">{quantity} × {currency}{Number(price).toFixed(2)}</span>
                  <span className="font-bold text-black">{currency}{(Number(quantity) * Number(price)).toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-b border-dashed border-gray-400 my-2"></div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">{t("print_receipt.subtotal") || "Subtotal"}:</span>
            <span>{currency}{Number(itemsTotal).toFixed(2)}</span>
          </div>
          {Number(taxTotal) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t("print_receipt.tax") || "Tax"}:</span>
              <span>{currency}{Number(taxTotal).toFixed(2)}</span>
            </div>
          )}
          {Number(serviceChargeTotal) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t("print_receipt.service_charge") || "Service Charge"}:</span>
              <span>{currency}{Number(serviceChargeTotal).toFixed(2)}</span>
            </div>
          )}
          {Number(deliveryFee || 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Fee:</span>
              <span>{currency}{Number(deliveryFee).toFixed(2)}</span>
            </div>
          )}
          <div className="border-b border-dashed border-gray-400 my-1"></div>
          <div className="flex justify-between text-base font-extrabold text-black pt-0.5">
            <span>{t("print_receipt.total") || "TOTAL"}:</span>
            <span>{currency}{Number(payableTotal).toFixed(2)}</span>
          </div>
        </div>

        {footer && (
          <div className="my-3 text-center">
            <div className="border-b border-dashed border-gray-400 mb-2"></div>
            <p className="text-xs text-gray-700 italic">{footer}</p>
          </div>
        )}

        {/* Token Section on Receipt */}
        {hasToken && (
          <div className="border-t-2 border-dashed border-black mt-4 pt-4 pb-2 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-black mb-1">
              {t("print_receipt.token_no") || "Token Number"}
            </p>
            <div className="w-20 h-20 mx-auto border-2 border-black flex items-center justify-center font-black text-3xl rounded-full text-black">
              {tokenNo}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
