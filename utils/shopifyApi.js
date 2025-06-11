const axios = require('axios');
const { shopifyDomain, accessToken, apiVersion } = require('../config/shopify');

const makeShopifyRequest = async (query, variables) => {
    try {
        const response = await axios.post(
            `https://${shopifyDomain}/admin/api/${apiVersion}/graphql.json`,
            {
                query,
                variables
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken,
                }
            }
        );

        if (response.data.errors) {
            throw new Error(response.data.errors[0].message);
        }

        return response.data.data;
    } catch (error) {
        console.error('Shopify API Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    makeShopifyRequest
}; 