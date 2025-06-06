require('dotenv').config();

console.log('Shopify Configuration:');
console.log('Domain:', process.env.SHOPIFY_DOMAIN);
console.log('Access Token:', process.env.SHOPIFY_ACCESS_TOKEN ? 'Present' : 'Missing');

if (!process.env.SHOPIFY_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
    console.error('Missing required Shopify environment variables');
    process.exit(1);
}

module.exports = {
    shopifyDomain: process.env.SHOPIFY_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: '2025-04'
}; 