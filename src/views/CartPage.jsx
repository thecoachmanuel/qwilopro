import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  IconChevronRight, IconCarrot, IconTrash, IconMinus, IconPlus,
  IconShoppingCartX, IconChevronLeft, IconX, IconNote,
  IconBike, IconBuildingStore, IconArmchair,
} from '@tabler/icons-react';
import { createOrderFromQrMenu, getCart, setCart, getQRMenuInit } from '../controllers/qrmenu.controller';
import { CURRENCIES } from '../config/currencies.config';
import { getImageURL } from '../helpers/ImageHelper';
import { iconStroke } from '../config/config';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { toast } from "react-hot-toast";
import { validatePhone } from '../utils/phoneValidator';
import { SocketContext } from '../contexts/SocketContext';
import { initSocket } from '../utils/socket';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const DELIVERY_TYPES = [
  { key: 'dinein',   label: 'Dine In',  Icon: IconArmchair },
  { key: 'pickup',   label: 'Pickup',   Icon: IconBuildingStore },
  { key: 'delivery', label: 'Delivery', Icon: IconBike },
];

const CartPage = () => {
  const { t } = useTranslation();
  const { socket, isSocketConnected } = useContext(SocketContext);
  const { theme } = useTheme();

  const [state, setState] = useState({
    cartItems: [], itemsTotal: 0, taxTotal: 0, serviceChargeTotal: 0,
    deliveryFeeTotal: 0, payableTotal: 0,
  });
  const [showPhoneFields, setShowPhoneFields] = useState(false);
  const [selectedCustomerType, setSelectedCustomerType] = useState(null);
  const [deliveryType, setDeliveryType] = useState('dinein'); // 'dinein' | 'pickup' | 'delivery'

  const params = useParams();
  const qrcode = params.slug || params.qrcode;
  const navigate = useNavigate();

  const location = useLocation();
  const initialState = location.state || {};

  const [meta, setMeta] = useState({
    storeTable: initialState.storeTable || null,
    currency: initialState.currency || "₦",
    serviceCharge: initialState.serviceCharge || null,
    storeSettings: initialState.storeSettings || null,
    storeTables: initialState.storeTables || [],
  });
  const [selectedTable, setSelectedTable] = useState(null);

  const { storeTable, currency, serviceCharge, storeSettings, storeTables } = meta;
  const isDeliveryEnabled = storeSettings?.is_delivery_enabled == 1;
  const deliveryFeeAmount = Number(storeSettings?.delivery_fee || 0);

  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);
  const dialogNotesIndexRef = useRef();
  const dialogNotesTextRef = useRef();

  useEffect(() => {
    const storedCart = getCart(qrcode) || [];
    updateCart(storedCart);

    if (storeTable) {
      setDeliveryType('dinein');
    } else {
      setDeliveryType((prev) => prev || 'dinein');
    }

    if (typeof window !== "undefined" && window.location.pathname.startsWith("/m/")) {
      const targetSlug = storeSettings?.slug || qrcode;
      navigate(`/${targetSlug}/cart${window.location.search}`, { replace: true, state: location.state });
    }
  }, []);

  useEffect(() => {
    async function loadMeta() {
      if ((!meta.storeSettings || !meta.storeTables || meta.storeTables.length === 0) && qrcode) {
        try {
          const res = await getQRMenuInit(qrcode);
          if (res.status === 200) {
            const data = res.data;
            const cur = CURRENCIES.find((c) => c.cc === data?.storeSettings?.currency);
            const newMeta = {
              storeTable: meta.storeTable || data?.storeTable || null,
              currency: cur?.symbol || meta.currency || "₦",
              serviceCharge: meta.serviceCharge !== null ? meta.serviceCharge : (data?.serviceCharge || null),
              storeSettings: meta.storeSettings || data?.storeSettings || null,
              storeTables: (data?.storeTables && data.storeTables.length > 0) ? data.storeTables : (meta.storeTables || []),
            };
            setMeta(newMeta);
            const storedCart = getCart(qrcode) || [];
            updateCart(storedCart, undefined, newMeta);
            if ((data?.storeTable || meta.storeTable)) {
              setDeliveryType('dinein');
            } else {
              setDeliveryType((prev) => prev || 'dinein');
            }
          }
        } catch (e) {
          console.error("Cart metadata fetch error:", e);
        }
      }
    }
    loadMeta();
  }, [qrcode]);

  const { cartItems, itemsTotal, taxTotal, serviceChargeTotal, deliveryFeeTotal, payableTotal } = state;

  const sendNewOrderEvent = () => {
    if (isSocketConnected) {
      socket.emit('new_qrorder_backend', {}, qrcode);
    } else {
      initSocket();
      socket?.emit?.('new_qrorder_backend', {}, qrcode);
    }
  };

  function removeItemFromCart(index) {
    const newCartItems = cartItems.filter((_, i) => i !== index);
    setCart(newCartItems, qrcode);
    updateCart(newCartItems);
  }

  function addCartItemQuantity(index, currentQuantity) {
    const newCartItems = [...cartItems];
    newCartItems[index].quantity = currentQuantity + 1;
    setCart(newCartItems, qrcode);
    updateCart(newCartItems);
  }

  function minusCartItemQuantity(index, currentQuantity) {
    let newCartItems = [...cartItems];
    newCartItems[index].quantity = currentQuantity - 1;
    if (newCartItems[index].quantity === 0) {
      newCartItems = newCartItems.filter((_, i) => i !== index);
    }
    setCart(newCartItems, qrcode);
    updateCart(newCartItems);
  }

  const calculateOrderSummary = (items, dType, currentMeta = meta) => {
    let itemsTotal = 0;
    let taxTotal = 0;
    let serviceChargeTotal = 0;
    let deliveryFeeTotal = 0;
    let payableTotal = 0;

    items.forEach((item) => {
      const taxRate = Number(item.tax_rate) || 0;
      const taxType = item.tax_type;
      const itemPrice = Number(item.price) * Number(item.quantity);

      if (taxType === 'exclusive') {
        const tax = (itemPrice * taxRate) / 100;
        taxTotal += tax;
        itemsTotal += itemPrice;
        payableTotal += itemPrice + tax;
      } else if (taxType === 'inclusive') {
        const tax = itemPrice - (itemPrice * (100 / (100 + taxRate)));
        taxTotal += tax;
        itemsTotal += itemPrice - tax;
        payableTotal += itemPrice;
      } else {
        itemsTotal += itemPrice;
        payableTotal += itemPrice;
      }
    });

    const activeServiceCharge = currentMeta?.serviceCharge ?? serviceCharge;
    if (activeServiceCharge) {
      const calculatedServiceCharge = (itemsTotal * Number(activeServiceCharge)) / 100;
      serviceChargeTotal += calculatedServiceCharge;
      payableTotal += calculatedServiceCharge;
    }

    const currentFee = Number(currentMeta?.storeSettings?.delivery_fee || deliveryFeeAmount || 0);
    // Add delivery fee only when delivery type is 'delivery'
    if ((dType || deliveryType) === 'delivery' && currentFee > 0) {
      deliveryFeeTotal = currentFee;
      payableTotal += currentFee;
    }

    return { itemsTotal, taxTotal, serviceChargeTotal, deliveryFeeTotal, payableTotal };
  };

  const updateCart = (items, dType, currentMeta = meta) => {
    const summary = calculateOrderSummary(items, dType, currentMeta);
    setState(prev => ({ ...prev, cartItems: items, ...summary }));
  };

  // Recalculate when delivery type changes
  const handleDeliveryTypeChange = (type) => {
    setDeliveryType(type);
    const summary = calculateOrderSummary(cartItems, type);
    setState(prev => ({ ...prev, ...summary }));
  };

  const btnPlaceOrder = async () => {
    if (!cartItems || cartItems.length === 0) {
      toast.error(t('cart.empty_cart') || "Your cart is empty.");
      return;
    }

    const activeDeliveryType = deliveryType || (storeTable ? 'dinein' : 'dinein');
    const isDelivery = activeDeliveryType === 'delivery';

    if (isDelivery) {
      const phone = phoneRef.current?.value || "";
      const name = nameRef.current?.value || "";
      const address = addressRef.current?.value || "";
      if (!name.trim()) { toast.error("Please enter your name for delivery."); return; }
      if (!phone.trim()) { toast.error("Please enter your phone number for delivery."); return; }
      if (!validatePhone(phone)) { toast.error(t('cart.valid_phone_error')); return; }
      if (!address.trim()) { toast.error("Please enter your delivery address."); return; }
    } else if (showPhoneFields) {
      const phone = phoneRef.current?.value || "";
      const name = nameRef.current?.value || "";
      if (!name.trim()) { toast.error(t('cart.name_required')); return; }
      if (!validatePhone(phone)) { toast.error(t('cart.valid_phone_error')); return; }
    }

    try {
      // Prefer: scanned QR table → picker selection → null
      const tableId = storeTable?.id || selectedTable?.id || null;
      const isCustomerInfo = isDelivery || showPhoneFields;
      const customerType = isCustomerInfo ? "CUSTOMER" : "WALKIN";
      const deliveryAddress = isDelivery ? (addressRef.current?.value || "").trim() : "";

      const customer = isCustomerInfo
        ? {
            name: (nameRef.current?.value || "").trim() || "Guest",
            phone: (phoneRef.current?.value || "").trim(),
            address: deliveryAddress,
          }
        : { name: "Guest", phone: "" };

      // Attach delivery address note to the first item for kitchen visibility
      if (deliveryAddress && cartItems.length > 0) {
        cartItems[0].notes = cartItems[0].notes
          ? `${cartItems[0].notes} | Delivery to: ${deliveryAddress}`
          : `Delivery to: ${deliveryAddress}`;
      }

      const appliedDeliveryFee = isDelivery ? deliveryFeeAmount : 0;

      toast.loading(t('cart.please_wait'));
      const res = await createOrderFromQrMenu(activeDeliveryType, cartItems, customerType, customer, tableId, qrcode, appliedDeliveryFee);
      toast.dismiss();

      if (res.status == 200) {
        const data = res.data;
        toast.success(t('cart.order_success'));
        document.getElementById("modal-place-order").close();

        // Play success sound
        try { new Audio('/new_order_sound.mp3').play().catch(() => {}); } catch {}

        setState({ ...state, cartItems: [] });
        setCart([], qrcode);
        setSelectedCustomerType(null);
        sendNewOrderEvent();

        // Navigate to success page with invoice ref if available
        navigate('/order-success', {
          state: {
            orderId: data.orderId,
            invoiceId: data.invoiceId,
            tokenNo: data.tokenNo || null,
            qrcode: storeSettings?.slug || qrcode,
            hasFeedback: storeSettings?.is_feedback_enabled == 1,
            deliveryType,
            deliveryFee: appliedDeliveryFee,
            payableTotal,
            currency,
            customerName: customer.name,
            deliveryAddress,
          }
        });
      }
    } catch (error) {
      const statusCode = error?.response?.status;
      const message = error?.response?.data?.message || t('cart.something_went_wrong');
      console.error(error);
      toast.dismiss();
      toast.error(message);
      // Only redirect to /order-failed for server errors (5xx) or network failures
      // For 4xx (bad request, not found), just show the error and let user retry
      if (!statusCode || statusCode >= 500) {
        navigate('/order-failed', { state: { qrcode: storeSettings?.slug || qrcode } });
      }
    }

  };

  const btnOpenNotesModal = (index, notes) => {
    dialogNotesIndexRef.current.value = index;
    dialogNotesTextRef.current.value = notes;
    document.getElementById('modal-notes').showModal();
  };

  const btnAddNotes = () => {
    const index = dialogNotesIndexRef.current.value;
    const notes = dialogNotesTextRef.current.value || null;
    const newCartItems = [...cartItems];
    newCartItems[index].notes = notes;
    setState({ ...state, cartItems: newCartItems });
  };

  const isDark = theme === 'black';

  return (
    <div className='w-full'>
      <div className='container w-full max-w-5xl mx-auto flex justify-center items-center'>
        <div className="w-full mx-auto max-w-5xl bg-gray-50 dark:bg-black rounded-xl p-4 h-screen border border-restro-green-light">

          {/* Header */}
          <div className="relative flex items-center justify-between p-4">
            <button className="absolute left-0 p-2" onClick={() => (window.history.length > 1 ? window.history.back() : navigate(`/${storeSettings?.slug || qrcode}`))}>
              <IconChevronLeft size={24} stroke={2} />
            </button>
            <h3 className="text-xl md:text-2xl font-bold text-center w-full">{t('cart.title')}</h3>
          </div>

          {/* Table info */}
          {storeTable && (
            <div className="flex items-center gap-2 mt-2 p-2 justify-center bg-white dark:bg-black rounded-lg shadow-sm">
              <IconArmchair size={20} stroke={2} className="text-restro-green" />
              <h3 className="text-base font-semibold">
                <span className="font-bold text-gray-800 dark:text-white">{storeTable.table_title}</span>
                {storeTable.floor && <span className="text-sm text-gray-500 ml-2">({storeTable.floor})</span>}
              </h3>
            </div>
          )}

          {/* Delivery Type Selector */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {DELIVERY_TYPES.filter(dt => {
              if (dt.key === 'delivery') return isDeliveryEnabled;
              return true; // dinein and pickup are always available
            }).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => handleDeliveryTypeChange(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition active:scale-95 whitespace-nowrap ${
                    deliveryType === key
                      ? 'border-restro-green bg-restro-border-green-light text-restro-green'
                      : 'border-restro-border-green bg-white dark:bg-black text-gray-500'
                  }`}
                >
                  <Icon size={16} stroke={iconStroke} /> {label}
                </button>
              ))}
            </div>

          {/* Cart Items */}
          <div className="mt-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            {cartItems.length > 0 ? (
              cartItems.map((item, i) => {
                const { title, price, quantity, image, notes } = item;
                const imageURL = getImageURL(image);
                return (
                  <div key={i} className="w-full bg-white dark:bg-black rounded-lg p-2 mb-2 md:mb-4 flex items-center justify-between">
                    <div className="flex items-start">
                      <div className="w-20 h-20 bg-gray-200 dark:bg-black rounded-lg overflow-hidden mr-4 flex items-center justify-center text-gray-500 flex-shrink-0">
                        {image ? (
                          <img src={imageURL} alt={title} className="object-cover w-full h-full" />
                        ) : (
                          <IconCarrot size={24} />
                        )}
                      </div>
                      <div className="flex-grow">
                        <p className="text-sm font-semibold line-clamp-2">{title}</p>
                        <div className="text-xs text-gray-400">
                          {item?.variant?.title && <p>{item.variant.title}</p>}
                          {item.addons?.length > 0 && <p>{item.addons.length} Addons</p>}
                        </div>
                        <p className="text-sm">{currency}{(price * quantity).toFixed(2)}</p>
                        {notes && <p className='text-xs text-gray-500'>{t('cart.notes')}: {notes}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center">
                        <button onClick={() => minusCartItemQuantity(i, quantity)} className="btn btn-square btn-xs rounded-lg">
                          <IconMinus stroke={iconStroke} size={14} />
                        </button>
                        <div className="text-center text-sm w-6">{quantity}</div>
                        <button onClick={() => addCartItemQuantity(i, quantity)} className="btn btn-square btn-xs rounded-lg">
                          <IconPlus stroke={iconStroke} size={14} />
                        </button>
                        <button onClick={() => removeItemFromCart(i)} className="text-restro-red transition ml-4 w-4 h-4">
                          <IconTrash stroke={iconStroke} className='w-full h-full' />
                        </button>
                      </div>
                      <button
                        onClick={() => btnOpenNotesModal(i, notes)}
                        className="text-sm transition active:scale-95 px-2 py-1 flex items-center gap-1 ml-auto rounded-xl border border-restro-border-green bg-restro-card-bg hover:bg-restro-button-hover"
                      >
                        <IconNote size={16} stroke={iconStroke} />
                        <p className='text-xs'>{t('cart.add_notes')}</p>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 flex flex-col justify-center items-center h-[60vh] gap-4">
                <IconShoppingCartX size={50} />
                <p className='text-xl'>{t('cart.empty_cart')}</p>
              </div>
            )}
          </div>

          {/* Order Summary */}
          {cartItems.length > 0 && (
            <div className="join join-vertical w-full mt-3">
              <div className="collapse collapse-arrow join-item bg-white dark:bg-black">
                <input type="checkbox" className="peer" />
                <div className="collapse-title text-base font-bold flex justify-between">
                  <span>{t('cart.payable_total')}</span>
                  <span className='text-restro-green font-bold'>{currency}{payableTotal.toFixed(2)}</span>
                </div>
                <div className="collapse-content space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t('cart.items_total')}</span>
                    <span>{currency}{itemsTotal.toFixed(2)}</span>
                  </div>
                  {taxTotal > 0 && (
                    <div className="flex justify-between">
                      <span>{t('cart.tax_total')}</span>
                      <span>{currency}{taxTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {serviceChargeTotal > 0 && (
                    <div className="flex justify-between">
                      <span>{t('cart.service_charge_total')}</span>
                      <span>{currency}{serviceChargeTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {deliveryFeeTotal > 0 && (
                    <div className="flex justify-between text-restro-green font-semibold">
                      <span>🚚 Delivery Fee</span>
                      <span>{currency}{deliveryFeeTotal.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="h-24" />

          {/* Checkout Button */}
          {cartItems.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black shadow-lg p-4 flex justify-between items-center rounded-2xl max-w-5xl mx-auto">
              <button
                onClick={() => document.getElementById('modal-place-order').showModal()}
                className="bg-restro-green text-white py-4 px-6 rounded-xl flex justify-between w-full items-center"
              >
                <p className="text-md font-bold">{t('cart.total')} {currency}{payableTotal.toFixed(2)}</p>
                <p className="text-white text-lg font-bold px-2 flex items-center">
                  {t('cart.checkout')} <IconChevronRight size={20} stroke={3} />
                </p>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Place Order Modal */}
      <dialog id="modal-place-order" className="modal modal-bottom sm:modal-middle w-full mx-auto max-w-5xl">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <div className="my-2 mx-auto w-full relative">
            <h3 className='text-center text-xl font-semibold'>{t('cart.continue_as')}</h3>
            <div className="absolute top-0 right-0 text-red-400 cursor-pointer">
              <button onClick={() => document.getElementById('modal-place-order').close()}>
                <IconX size={20} />
              </button>
            </div>

            {/* Delivery type summary in modal */}
            {deliveryType && (
              <div className="mt-3 flex justify-center">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-restro-border-green-light text-restro-green border border-restro-green">
                  {DELIVERY_TYPES.find(d => d.key === deliveryType)?.label || deliveryType}
                  {deliveryType === 'delivery' && deliveryFeeAmount > 0 && ` (+${currency}${deliveryFeeAmount.toFixed(2)} delivery fee)`}
                </span>
              </div>
            )}

            {/* Table selector for Dine In (only when no QR table is pre-set) */}
            {deliveryType === 'dinein' && !storeTable && (
              <div className="mt-3">
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Select Table <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {storeTables && storeTables.length > 0 ? (
                  <select
                    className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-green"
                    value={selectedTable?.id || ""}
                    onChange={(e) => {
                      const found = storeTables.find((t) => String(t.id) === e.target.value);
                      setSelectedTable(found || null);
                    }}
                  >
                    <option value="">— No table (Pickup / Walk-in) —</option>
                    {storeTables.map((tbl) => (
                      <option key={tbl.id} value={tbl.id}>
                        {tbl.table_title}{tbl.floor ? ` (${tbl.floor})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No tables configured for this store.</p>
                )}
              </div>
            )}

            {deliveryType === 'delivery' ? (
              <div className="mt-4">
                <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  🚚 Please provide your delivery address and contact details so we can deliver your order promptly.
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    ref={nameRef}
                    className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-green"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    ref={phoneRef}
                    className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-green"
                    placeholder="e.g. +234 801 234 5678"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    ref={addressRef}
                    rows={2}
                    className="text-sm w-full rounded-xl px-4 py-2.5 border border-restro-border-green dark:bg-black focus:outline-restro-green resize-none"
                    placeholder="Street address, apartment/flat, landmark"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-around mt-4">
                  <button
                    className={`rounded-xl transition px-4 py-3 text-base font-semibold border-2 ${
                      !showPhoneFields
                        ? 'bg-white dark:bg-black border-restro-green text-restro-green'
                        : 'bg-gray-100 dark:bg-black text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setShowPhoneFields(false)}
                  >
                    {t('cart.guest')}
                  </button>

                  <div className="relative flex items-center justify-center my-4">
                    <div className="border-t border-restro-border-green w-full"></div>
                    <span className="absolute bg-white dark:bg-black px-4 text-gray-500 text-xs">{t('cart.or')}</span>
                  </div>

                  <button
                    className={`rounded-xl transition px-4 py-3 text-base font-semibold border-2 ${
                      showPhoneFields
                        ? 'bg-white dark:bg-black border-restro-green text-restro-green'
                        : 'bg-gray-100 dark:bg-black text-restro-text hover:bg-gray-200 border-restro-border-green'
                    }`}
                    onClick={() => setShowPhoneFields(true)}
                  >
                    {t('cart.using_phone_number')}
                  </button>
                </div>

                {showPhoneFields && (
                  <div className="mt-4">
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('cart.name_label')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        ref={nameRef}
                        className="text-sm w-full rounded-xl px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-green"
                        placeholder={t('cart.name_placeholder')}
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('cart.phone_label')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        ref={phoneRef}
                        className="text-sm w-full rounded-xl px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-green"
                        placeholder={t('cart.phone_placeholder')}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-action justify-center w-full">
            <button
              onClick={() => btnPlaceOrder()}
              className="rounded-lg hover:bg-restro-green-dark transition active:scale-95 hover:shadow-lg px-4 py-4 bg-restro-green text-white w-full text-xl font-semibold"
            >
              {t('cart.place_order')}
            </button>
          </div>
        </div>
      </dialog>

      {/* Notes Modal */}
      <dialog id="modal-notes" className="modal modal-bottom sm:modal-middle">
        <div className='modal-box border border-restro-border-green dark:rounded-2xl'>
          <h3 className="font-bold text-lg">{t('cart.add_notes')}</h3>
          <div className="my-4">
            <input type="hidden" ref={dialogNotesIndexRef} />
            <label htmlFor="dialogNotesText" className="mb-1 block text-gray-500 text-sm">
              {t('cart.notes')} <span className="text-xs text-gray-500">(100 character max.)</span>
            </label>
            <input
              ref={dialogNotesTextRef} type="text" name="dialogNotesText" id='dialogNotesText'
              className='text-sm w-full rounded-lg px-4 py-2 border border-restro-border-green dark:bg-black focus:outline-restro-border-green'
              placeholder={t('cart.notes_placeholder')}
            />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="rounded-lg transition active:scale-95 px-4 py-3 bg-restro-gray hover:bg-restro-button-hover text-restro-text">{t('cart.close')}</button>
              <button onClick={() => btnAddNotes()} className="rounded-lg hover:bg-green-800 transition active:scale-95 px-4 py-3 bg-restro-green text-white ml-3">{t('cart.save')}</button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default CartPage;
