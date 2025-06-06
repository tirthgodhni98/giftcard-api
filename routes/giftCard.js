const express = require('express');
const router = express.Router();
const GiftCard = require('../models/GiftCard');

// Create a new gift card
router.post('/', async (req, res) => {
    try {
        const { email, name, amount } = req.body;
        
        // Validate required fields
        if (!email || !name || !amount) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const giftCard = new GiftCard({
            email,
            name,
            amount
        });

        const savedGiftCard = await giftCard.save();
        res.status(201).json(savedGiftCard);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all gift cards
router.get('/', async (req, res) => {
    try {
        const giftCards = await GiftCard.find();
        res.json(giftCards);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 