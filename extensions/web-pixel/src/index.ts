import { register } from '@shopify/web-pixels-extension';

register(({ analytics, browser }) => {
  // Type declaration for window object to include dataLayer
  // Bootstrap and insert Google Tag Manager script tag here
  // Subscribe to Shopify analytics events
  //  analytics.subscribe('page_viewed', (event) => {
  //    console.log('Page viewed from extension', event);
  //  });
  //  analytics.subscribe('purchase', (event) => {
  //    console.log('Purchase event from extension', event);
  //  });
  //  analytics.subscribe('checkout_completed', (event) => {
  //    console.log('checkout_completed event from extension', event);
  //  });
  //  analytics.subscribe('product_viewed', (data) => {
  //    console.log('CustomAnalytics extension - Product viewed:', data);
  //  });
  //  analytics.subscribe('collection_viewed', (data) => {
  //    console.log('CustomAnalytics extension - Collection viewed:', data);
  //  });
  //  analytics.subscribe('cart_viewed', (data) => {
  //    console.log('CustomAnalytics extension - Cart viewed:', data);
  //  });
  //  analytics.subscribe('cart_updated', (data) => {
  //    console.log('CustomAnalytics extension - Cart updated:', data);
  //  });
});
