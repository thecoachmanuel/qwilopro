import React from "react";
import { getDetailsForReceiptPrint } from "../helpers/ReceiptHelper";
import { getImageURL } from "../helpers/ImageHelper";
import { useTranslation } from "react-i18next";

export default function PrintTokenPage() {
  const { t } = useTranslation();
  const receiptDetails = getDetailsForReceiptPrint();

  const {
    storeSettings = {},
    printSettings = {},
    tokenNo,
    orderId,
    deliveryType,
    customer,
  } = receiptDetails || {};

  const {
    store_name = 'Order Token',
    store_image: storeImage,
  } = storeSettings || {};

  const page_format = printSettings?.page_format || 80;

  const handlePrint = () => {
    window.print();
  };

  if (!receiptDetails || !tokenNo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 font-['Nunito'] text-gray-700 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm">
          <p className="text-4xl mb-3">🎫</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Token Data</h2>
          <p className="text-sm text-gray-500 mb-6">No active token was found to print.</p>
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
          <span>🖨️</span> Print Token
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border shadow-sm text-sm transition"
        >
          Close
        </button>
      </div>

      <div
        className="font-sans px-3 py-6 bg-white text-black shadow-lg print:shadow-none print:m-0 text-center"
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

        {/* Store Logo / Store Name */}
        {storeImage ? (
          <img
            src={getImageURL(storeImage)}
            className="w-12 h-12 mx-auto object-cover rounded-xl mb-1.5"
            alt={store_name}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-10 h-10 mx-auto rounded-xl bg-gray-900 text-white font-bold flex items-center justify-center text-sm mb-1.5">
            {store_name.charAt(0).toUpperCase()}
          </div>
        )}
        <h2 className="font-extrabold text-sm uppercase tracking-wider text-black">{store_name}</h2>

        <div className="border-b border-dashed border-gray-400 my-3"></div>

        <p className="text-xs uppercase font-bold tracking-widest text-gray-600 mb-2">
          {t("print_token.token_no") || "Your Order Token"}
        </p>

        {/* Big Bold Token Number */}
        <div className="w-28 h-28 mx-auto border-3 border-black text-black flex items-center justify-center font-black text-5xl rounded-full my-3">
          #{tokenNo}
        </div>

        {deliveryType && (
          <p className="text-xs font-semibold capitalize text-gray-800 mt-2">
            Order Type: {deliveryType}
          </p>
        )}

        {orderId && (
          <p className="text-xs text-gray-600 mt-0.5">
            Order #{orderId}
          </p>
        )}

        {customer?.name && (
          <p className="text-xs text-gray-600 mt-0.5">
            Customer: {customer.name}
          </p>
        )}

        <div className="border-b border-dashed border-gray-400 my-3"></div>

        <p className="text-[11px] text-gray-500">
          {new Date().toLocaleString('en-US', { hour12: true, dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">Please wait for your token to be called</p>
      </div>
    </div>
  );
}
