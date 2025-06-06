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

// Create a new gift card
router.post('/create-gift-card', async (req, res) => {
    console.log('create-gift-card req::: ', req.body);

    // Validate required fields
    if (!req.body.email || !req.body.name) {
        return res.status(400).json({
            error: 'Missing required fields',
            message: 'Both email and name are required'
        });
    }

    const query = `
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

    const body = {
        query: query,
        variables: {
            input: {
                initialValue: Number(req.body.amount || 70.0),
                note: req.body.message || 'Happy Birthday!',
            },
        },
    };

    try {
        // Create gift card in Shopify
        const response = await axios.post(
            `https://${shopifyDomain}/admin/api/${apiVersion}/graphql.json`,
            JSON.parse(JSON.stringify(body)),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken,
                },
            }
        );

        console.log('Shopify Response:', JSON.stringify(response.data, null, 2));

        // Check if response has errors
        if (response.data.errors) {
            return res.status(400).json({
                error: 'Shopify API Error',
                details: response.data.errors
            });
        }

        const giftCardData = response.data.data?.giftCardCreate;
        
        if (!giftCardData) {
            return res.status(400).json({
                error: 'Invalid Response',
                message: 'No gift card data received from Shopify'
            });
        }

        // Check for Shopify user errors
        if (giftCardData.userErrors && giftCardData.userErrors.length > 0) {
            return res.status(400).json({
                error: 'Shopify Error',
                details: giftCardData.userErrors
            });
        }

        // Save to MongoDB
        const giftCard = new GiftCard({
            giftCardId: giftCardData.giftCard.id,
            initialValue: parseFloat(giftCardData.giftCard.initialValue.amount),
            balance: parseFloat(giftCardData.giftCard.balance.amount),
            createdAt: new Date(giftCardData.giftCard.createdAt),
            maskedCode: giftCardData.giftCard.maskedCode,
            giftCardCode: giftCardData.giftCardCode,
            note: giftCardData.giftCard.note,
            shopifyDomain: shopifyDomain,
            email: req.body.email,
            name: req.body.name
        });

        const savedGiftCard = await giftCard.save();
        console.log('Gift card saved to MongoDB:', savedGiftCard);
        
        res.json({
            success: true,
            data: savedGiftCard,
            shopifyResponse: response.data
        });
    } catch (error) {
        console.error('Error creating gift card:', error);
        console.error('Error details:', error.response?.data || error.message);
        
        res.status(500).json({
            error: 'Error creating gift card',
            details: error.response?.data || error.message
        });
    }
});

// Get all gift cards
router.get('/giftcards', async (req, res) => {
    try {
        const giftCards = await GiftCard.find();
        res.json(giftCards);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 