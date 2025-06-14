const express = require('express');
const router = express.Router();
const GiftCard = require('../models/GiftCard');
const axios = require('axios');
const Shop = require('../models/Shop');
const apiVersion = '2025-04';

// Helper function to get store information from request and DB
const getStoreInfo = async (req) => {
    const storeInfo = req.body?.store || {};
    const domain = storeInfo.domain;

    if (!domain) {
        throw new Error('Missing required store information (domain)');
    }

    // Fetch accessToken from DB
    const shop = await Shop.findOne({ domain });
    if (!shop) {
        throw new Error('Shop not found for domain: ' + domain);
    }

    return {
        domain,
        token: shop.accessToken
    };
};

const makeShopifyRequest = async (query, variables, req) => {
    console.log('\n=== Calling Shopify API MakeShopifyRequest ===\n');

    console.log('req.shopify::: ', req.body);
    console.log('req.body store::: ', req.body?.store);

    try {
        const { domain, token } = await getStoreInfo(req);

        console.log('domain::: ', domain);
        console.log('token::: ', token);

        const response = await axios.post(
            `https://${domain}/admin/api/${apiVersion}/graphql.json`,
            {
                query,
                variables
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': token,
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

// Debug middleware for this router
router.use((req, res, next) => {
    console.log('GiftCard Router:', req.method, req.url);
    next();
});

// Create a new gift card
router.post('/create-gift-card', async (req, res) => {
    try {
        const { email, name, amount, message } = req.body;

        console.log('req.body::: ', req.body);

        if (!email || !name) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Both email and name are required'
            });
        }

        // First fetch shop information
        const shopQuery = `
            query {
                shop {
                    name
                    myshopifyDomain
                    primaryDomain {
                        url
                    }
                }
            }
        `;

        const shopData = await makeShopifyRequest(shopQuery, null, req);
        
        // Get Shopify user information
        const userQuery = `
            query {
                shop {
                    name
                    myshopifyDomain
                    primaryDomain {
                        url
                    }
                    owner {
                        firstName
                        lastName
                        email
                    }
                }
            }
        `;
        
        let shopifyUser = null;
        try {
            const userData = await makeShopifyRequest(userQuery, null, req);
            shopifyUser = userData.shop.owner;
        } catch (error) {
            console.log('Error fetching Shopify user:', error.message);
        }

        console.log('\n=== Gift Card Creation Details ===\n');
        console.log('Store Information:');
        console.log('------------------');
        console.log('Store Name:', shopData.shop.name);
        console.log('Shopify Domain:', shopData.shop.myshopifyDomain);
        console.log('Primary Domain:', shopData.shop.primaryDomain.url);
        
        if (shopifyUser) {
            console.log('\nShopify User Information:');
            console.log('------------------');
            console.log('Email:', shopifyUser.email);
            console.log('Name:', `${shopifyUser.firstName} ${shopifyUser.lastName}`);
        }

        console.log('\nCustomer Information:');
        console.log('------------------');
        console.log('Name:', name);
        console.log('Email:', email);
        console.log('\nGift Card Details:');
        console.log('------------------');
        console.log('Initial Amount:', amount);
        console.log('Message:', message || 'Thank you for your purchase!');
        console.log('\nCreated By:');
        console.log('------------------');
        
        // Try to get user information from various sources
        const userInfo = {
            fromHeaders: {
                email: req.headers['x-user-email'] || req.headers['X-User-Email'],
                name: req.headers['x-user-name'] || req.headers['X-User-Name']
            },
            fromBody: {
                email: req.body.email,
                name: req.body.name
            },
            fromQuery: {
                email: req.query.email,
                name: req.query.name
            },
            fromCookies: {
                email: req.cookies?.userEmail,
                name: req.cookies?.userName
            },
            fromShopify: shopifyUser ? {
                email: shopifyUser.email,
                name: `${shopifyUser.firstName} ${shopifyUser.lastName}`
            } : null
        };

        if (req.user) {
            console.log('User (from auth):', req.user.email);
            console.log('Name (from auth):', req.user.name);
            console.log('Role (from auth):', req.user.role);
        } else if (userInfo.fromShopify) {
            console.log('User (from Shopify):', userInfo.fromShopify.email);
            console.log('Name (from Shopify):', userInfo.fromShopify.name);
        } else if (userInfo.fromHeaders.email) {
            console.log('User (from headers):', userInfo.fromHeaders.email);
            console.log('Name (from headers):', userInfo.fromHeaders.name);
        } else if (userInfo.fromBody.email) {
            console.log('User (from body):', userInfo.fromBody.email);
            console.log('Name (from body):', userInfo.fromBody.name);
        } else if (userInfo.fromQuery.email) {
            console.log('User (from query):', userInfo.fromQuery.email);
            console.log('Name (from query):', userInfo.fromQuery.name);
        } else if (userInfo.fromCookies.email) {
            console.log('User (from cookies):', userInfo.fromCookies.email);
            console.log('Name (from cookies):', userInfo.fromCookies.name);
        } else {
            console.log('User: Anonymous (No user information found)');
            console.log('Available user information sources:');
            console.log('- Shopify User');
            console.log('- Headers (X-User-Email, X-User-Name)');
            console.log('- Request Body (email, name)');
            console.log('- Query Parameters (email, name)');
            console.log('- Cookies (userEmail, userName)');
        }

        console.log('IP Address:', req.ip);
        console.log('User Agent:', req.headers['user-agent']);
        console.log('----------------------------------------\n');

        const createGiftCardMutation = `
            mutation giftCardCreate($input: GiftCardCreateInput!) {
                giftCardCreate(input: $input) {
                    giftCard {
                        id
                        initialValue {
                            amount
                        }
                        balance {
                            amount
                        }
                        createdAt
                        maskedCode
                        note
                    }
                    giftCardCode
                    userErrors {
                        message
                        field
                        code
                    }
                }
            }
        `;

        const variables = {
            input: {
                initialValue: Number(amount || 70.0),
                note: message || 'Thank you for your purchase!',
                templateSuffix: "gift_card",
                expiresOn: null,
                customerId: null
            }
        };

        const data = await makeShopifyRequest(createGiftCardMutation, variables, req);
        const giftCardData = data.giftCardCreate;
        
        if (giftCardData.userErrors?.length > 0) {
            return res.status(400).json({
                error: 'Shopify Error',
                details: giftCardData.userErrors
            });
        }

        const giftCard = new GiftCard({
            giftCardId: giftCardData.giftCard.id,
            initialValue: parseFloat(giftCardData.giftCard.initialValue.amount),
            balance: parseFloat(giftCardData.giftCard.balance.amount),
            createdAt: new Date(giftCardData.giftCard.createdAt),
            maskedCode: giftCardData.giftCard.maskedCode,
            giftCardCode: giftCardData.giftCardCode,
            note: giftCardData.giftCard.note,
            shopifyDomain: shopData.shop.myshopifyDomain,
            email,
            name,
            status: 'active'  // Set default status as active
        });

        const savedGiftCard = await giftCard.save();
        
        console.log('\nGift Card Created Successfully:');
        console.log('------------------');
        console.log('Gift Card ID:', savedGiftCard.giftCardId);
        console.log('Initial Value:', savedGiftCard.initialValue);
        console.log('Balance:', savedGiftCard.balance);
        console.log('Gift Card Code:', savedGiftCard.giftCardCode);
        console.log('Status:', savedGiftCard.status);
        console.log('Created At:', savedGiftCard.createdAt.toISOString());
        console.log('----------------------------------------\n');

        res.json({
            success: true,
            data: savedGiftCard
        });
    } catch (error) {
        console.error('Error creating gift card:', error);
        res.status(500).json({
            error: 'Error creating gift card',
            details: error.message
        });
    }
});

// Get all gift cards
router.get('/giftcards', async (req, res) => {
    try {
        const giftCards = await GiftCard.find();
        res.json(giftCards);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching gift cards', details: error.message });
    }
});

// Search gift cards
router.get('/search', async (req, res) => {
    try {
        const { email, name, code, status } = req.query;
        const query = {};

        if (email) query.email = new RegExp(email, 'i');
        if (name) query.name = new RegExp(name, 'i');
        if (code) query.giftCardCode = code;
        if (status) query.status = status;
        console.log('query::: ', query);
        const giftCards = await GiftCard.find(query);
        res.json(giftCards);
    } catch (error) {
        res.status(500).json({ error: 'Error searching gift cards', details: error.message });
    }
});

// Reload gift card
router.post('/reload/:giftCardId', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const giftCard = await GiftCard.findOne({ giftCardId: req.params.giftCardId });
        if (!giftCard) {
            return res.status(404).json({ error: 'Gift card not found' });
        }

        if (giftCard.status === 'disabled') {
            return res.status(400).json({ error: 'Cannot reload disabled gift card' });
        }

        const reloadMutation = `
            mutation giftCardReload($id: ID!, $amount: Decimal!) {
                giftCardReload(id: $id, amount: $amount) {
                    giftCard {
                        id
                        balance {
                            amount
                        }
                    }
                    userErrors {
                        message
                        field
                        code
                    }
                }
            }
        `;

        const data = await makeShopifyRequest(reloadMutation, {
            id: giftCard.giftCardId,
            amount: amount
        }, req);

        if (data.giftCardReload.userErrors?.length > 0) {
            return res.status(400).json({
                error: 'Error reloading gift card',
                details: data.giftCardReload.userErrors
            });
        }

        giftCard.balance = parseFloat(data.giftCardReload.giftCard.balance.amount);
        await giftCard.save();

        res.json({
            success: true,
            data: giftCard
        });
    } catch (error) {
        res.status(500).json({ error: 'Error reloading gift card', details: error.message });
    }
});

// Lookup gift card
router.get('/lookup/:code', async (req, res) => {
    try {
        const giftCard = await GiftCard.findOne({ giftCardCode: req.params.code });
        if (!giftCard) {
            return res.status(404).json({ error: 'Gift card not found' });
        }

        // Get latest balance from Shopify
        const query = `
            query getGiftCard($id: ID!) {
                giftCard(id: $id) {
                    id
                    balance {
                        amount
                    }
                    status
                }
            }
        `;

        const data = await makeShopifyRequest(query, { id: giftCard.giftCardId }, req);
        
        // Update local balance
        giftCard.balance = parseFloat(data.giftCard.balance.amount);
        giftCard.status = data.giftCard.status === 'DISABLED' ? 'disabled' : 'active';
        await giftCard.save();

        res.json(giftCard);
    } catch (error) {
        res.status(500).json({ error: 'Error looking up gift card', details: error.message });
    }
});

// Redeem gift card
router.post('/redeem/:giftCardId', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const giftCard = await GiftCard.findOne({ giftCardId: req.params.giftCardId });
        if (!giftCard) {
            return res.status(404).json({ error: 'Gift card not found' });
        }

        if (giftCard.status === 'disabled') {
            return res.status(400).json({ error: 'Cannot redeem disabled gift card' });
        }

        if (giftCard.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        const adjustMutation = `
            mutation giftCardAdjust($id: ID!, $amount: Decimal!) {
                giftCardAdjust(id: $id, amount: -$amount) {
                    giftCard {
                        id
                        balance {
                            amount
                        }
                    }
                    userErrors {
                        message
                        field
                        code
                    }
                }
            }
        `;

        const data = await makeShopifyRequest(adjustMutation, {
            id: giftCard.giftCardId,
            amount: amount
        }, req);

        if (data.giftCardAdjust.userErrors?.length > 0) {
            return res.status(400).json({
                error: 'Error redeeming gift card',
                details: data.giftCardAdjust.userErrors
            });
        }

        giftCard.balance = parseFloat(data.giftCardAdjust.giftCard.balance.amount);
        await giftCard.save();

        res.json({
            success: true,
            data: giftCard
        });
    } catch (error) {
        res.status(500).json({ error: 'Error redeeming gift card', details: error.message });
    }
});

// Disable gift card
router.post('/disable/:giftCardId', async (req, res) => {
    try {
        const giftCard = await GiftCard.findOne({ giftCardId: req.params.giftCardId });
        if (!giftCard) {
            return res.status(404).json({ error: 'Gift card not found' });
        }

        const disableMutation = `
            mutation giftCardDisable($id: ID!) {
                giftCardDisable(id: $id) {
                    giftCard {
                        id
                        status
                    }
                    userErrors {
                        message
                        field
                        code
                    }
                }
            }
        `;

        const data = await makeShopifyRequest(disableMutation, { id: giftCard.giftCardId }, req);
        
        if (data.giftCardDisable.userErrors?.length > 0) {
            return res.status(400).json({
                error: 'Error disabling gift card',
                details: data.giftCardDisable.userErrors
            });
        }

        giftCard.status = 'disabled';
        await giftCard.save();

        res.json({
            success: true,
            data: giftCard
        });
    } catch (error) {
        res.status(500).json({ error: 'Error disabling gift card', details: error.message });
    }
});

// View transaction history
router.get('/transactions/:giftCardId', async (req, res) => {
    try {
        const giftCard = await GiftCard.findOne({ giftCardId: req.params.giftCardId });
        if (!giftCard) {
            return res.status(404).json({ error: 'Gift card not found' });
        }

        const query = `
            query giftCardTransactions($id: ID!) {
                giftCard(id: $id) {
                    transactions(first: 50) {
                        edges {
                            node {
                                amount
                                createdAt
                                type
                                balance {
                                    amount
                                }
                                note
                            }
                        }
                    }
                }
            }
        `;

        const data = await makeShopifyRequest(query, { id: giftCard.giftCardId }, req);
        
        const transactions = data.giftCard.transactions.edges.map(edge => ({
            ...edge.node,
            amount: parseFloat(edge.node.amount),
            balance: parseFloat(edge.node.balance.amount)
        }));

        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching transactions', details: error.message });
    }
});

module.exports = router; 