const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    giftCardId: {
        type: String,
        required: true,
        unique: true
    },
    initialValue: {
        type: Number,
        required: true,
        min: 0
    },
    balance: {
        type: Number,
        required: true,
        min: 0
    },
    createdAt: {
        type: Date,
        required: true
    },
    maskedCode: {
        type: String,
        required: true
    },
    giftCardCode: {
        type: String,
        required: true
    },
    note: {
        type: String,
        default: 'Happy Birthday!'
    },
    shopifyDomain: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'disabled'],
        default: 'active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GiftCard', giftCardSchema); 