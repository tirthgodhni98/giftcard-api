const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true },
  accessToken: { type: String, required: true }
});

module.exports = mongoose.model('Shop', shopSchema, 'shops'); 