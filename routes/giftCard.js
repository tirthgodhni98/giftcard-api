const express = require('express');
const router = express.Router();
const axios = require('axios');
const { shopifyDomain, accessToken, apiVersion } = require('../config/shopify');
const GiftCard = require('../models/GiftCard');

// Debug middleware for this router
router.use((req, res, next) => {
    console.log('GiftCard Router:', req.method, req.url);
    next();
});

// Helper function for Shopify GraphQL requests
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

// Create a new gift card
router.post('/create-gift-card', async (req, res) => {
    try {
        const { email, name, amount, message } = req.body;

        if (!email || !name) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Both email and name are required'
            });
        }

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
                        disabledAt
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
            }
        };

        const data = await makeShopifyRequest(createGiftCardMutation, variables);
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
            shopifyDomain: shopifyDomain,
            email,
            name,
            status: giftCardData.giftCard.disabledAt ? 'disabled' : 'active'
        });

        const savedGiftCard = await giftCard.save();
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
        });

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
                    disabledAt
                }
            }
        `;

        const data = await makeShopifyRequest(query, { id: giftCard.giftCardId });
        
        // Update local balance
        giftCard.balance = parseFloat(data.giftCard.balance.amount);
        giftCard.status = data.giftCard.disabledAt ? 'disabled' : 'active';
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
        });

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

// Update gift card status
router.patch('/status/:giftCardId', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'disabled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const giftCard = await GiftCard.findOne({ giftCardId: req.params.giftCardId });
        if (!giftCard) {
            return res.status(404).json({ error: 'Gift card not found' });
        }

        let data;
        if (status === 'disabled') {
            const disableMutation = `
                mutation giftCardDisable($id: ID!) {
                    giftCardDisable(id: $id) {
                        giftCard {
                            id
                            disabledAt
                        }
                        userErrors {
                            message
                            field
                            code
                        }
                    }
                }
            `;

            data = await makeShopifyRequest(disableMutation, { id: giftCard.giftCardId });
            
            if (data.giftCardDisable.userErrors?.length > 0) {
                return res.status(400).json({
                    error: 'Error disabling gift card',
                    details: data.giftCardDisable.userErrors
                });
            }
        } else {
            const enableMutation = `
                mutation giftCardEnable($id: ID!) {
                    giftCardEnable(id: $id) {
                        giftCard {
                            id
                            disabledAt
                        }
                        userErrors {
                            message
                            field
                            code
                        }
                    }
                }
            `;

            data = await makeShopifyRequest(enableMutation, { id: giftCard.giftCardId });
            
            if (data.giftCardEnable.userErrors?.length > 0) {
                return res.status(400).json({
                    error: 'Error enabling gift card',
                    details: data.giftCardEnable.userErrors
                });
            }
        }

        giftCard.status = status;
        await giftCard.save();

        res.json({
            success: true,
            data: giftCard
        });
    } catch (error) {
        res.status(500).json({ error: 'Error updating gift card status', details: error.message });
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

        const data = await makeShopifyRequest(query, { id: giftCard.giftCardId });
        
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