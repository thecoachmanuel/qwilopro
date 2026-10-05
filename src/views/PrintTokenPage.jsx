import React from "react";
import { getDetailsForReceiptPrint } from "../helpers/ReceiptHelper";
import { useTranslation } from "react-i18next";

export default function PrintTokenPage() {
  const { t } = useTranslation();
  const receiptDetails = getDetailsForReceiptPrint();

  const {
    printSettings = {},
    tokenNo,
  } = receiptDetails || {};

  const page_format = printSettings?.page_format || 80;

  return (
    <div className={`w-[${page_format}mm] font-sans px-2 bg-white text-black`}>
      <div className="mt-4 py-8 text-center">
        {t("print_token.token_no")}
        <div className="w-28 h-28 mx-auto border-black border-2 text-black flex items-center justify-center font-bold text-4xl rounded-full">
          {tokenNo}
        </div>
      </div>

      <p className="mt-2 text-center">{new Date().toLocaleString('en-US', {hour12: true, dateStyle: "long", timeStyle: "short"})}</p>
    </div>
  );
}
