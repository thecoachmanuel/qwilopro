import ClientApp from './ClientApp';
import mongoose from 'mongoose';
import { connectDB } from '../../backend/db/connect';
import { StoreDetails } from '../../backend/models';

export async function generateMetadata({ params }) {
  const slugArray = params?.slug || [];

  const defaultMeta = {
    title: 'QwiloPro SaaS - Restaurant POS & Digital Menu',
    description: 'Cloud POS and contactless QR digital menu software for restaurants, cafes, hotels, and food trucks.',
    openGraph: {
      title: 'QwiloPro SaaS - Restaurant POS & Digital Menu',
      description: 'Cloud POS and contactless QR digital menu software for restaurants and cafes.',
      images: ['/logo.png'],
    },
  };

  try {
    if (!slugArray.length) {
      return {
        title: 'Sign In | QwiloPro POS',
        description: 'Sign in to access your POS and restaurant management dashboard.',
      };
    }

    const firstSegment = slugArray[0]?.toLowerCase();

    if (firstSegment === 'login') {
      return { title: 'Sign In | QwiloPro POS', description: 'Sign in to access your restaurant POS and dashboard.' };
    }
    if (firstSegment === 'register') {
      return { title: 'Register Restaurant | QwiloPro SaaS', description: 'Start your restaurant POS and QR ordering management with QwiloPro.' };
    }
    if (firstSegment === 'admin' || firstSegment === 'superadmin') {
      return { title: 'Super Admin Portal | QwiloPro', description: 'Super Administrator management panel.' };
    }

    // QR Menu, Cart, Feedback or Storefront slug
    let identifier = null;
    let isFeedback = false;
    let isCart = false;

    if (firstSegment === 'm' && slugArray[1]) {
      identifier = slugArray[1];
      if (slugArray[2] === 'feedback') isFeedback = true;
      if (slugArray[2] === 'cart') isCart = true;
    } else if (slugArray.length === 1 && !['dashboard', 'display', 'print-receipt', 'print-token', 'success', 'cancelled-payment'].includes(firstSegment)) {
      identifier = firstSegment;
    }

    if (identifier) {
      await connectDB();
      const cleanCode = String(identifier).trim().toLowerCase();
      const isNum = !isNaN(cleanCode) && cleanCode !== '';
      const numericId = isNum ? parseInt(cleanCode, 10) : -999999;

      const store = await StoreDetails.findOne({
        $or: [
          ...(isNum ? [{ tenant_id: numericId }] : []),
          { unique_qr_code: identifier },
          { slug: cleanCode },
          { slug: identifier },
          { custom_domain: cleanCode },
        ],
      }).select('app_title tagline image_path address').lean();

      if (store) {
        const storeName = store.app_title || 'Restaurant';
        const tagline = store.tagline || (isFeedback ? `Share your dining feedback with ${storeName}` : `View our digital menu and order from ${storeName}`);
        const pageTitle = isFeedback 
          ? `Feedback & Review | ${storeName}` 
          : isCart 
            ? `Your Cart | ${storeName} Menu`
            : `${storeName} | Digital Menu & Online Ordering`;

        const image = store.image_path || '/logo.png';

        return {
          title: pageTitle,
          description: tagline,
          openGraph: {
            title: pageTitle,
            description: tagline,
            images: [image],
          },
          twitter: {
            card: 'summary_large_image',
            title: pageTitle,
            description: tagline,
            images: [image],
          },
        };
      }
    }
  } catch (err) {
    // Graceful fallback if database is cold or connection error occurs
  }

  return defaultMeta;
}

export default function CatchAllPage() {
  return <ClientApp />;
}
