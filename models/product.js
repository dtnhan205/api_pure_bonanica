const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, unique: true },
  status: { type: String, enum: ['hidden', 'show'], default: 'show' },
  brand: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true }
    }
  ],
  category: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true }
    }
  ],
  images: [{ type: String }],
  short_description: [{ type: String }],
  description: [{ type: String }],
  instructions: [
    {
      method_to_use: { type: Number },
      'name-methodto_use': { type: String },
      Instructions: [
        {
          step: { type: String },
          step_content: { type: String }
        }
      ]
    }
  ],
  ingredients: [
    {
      name: { type: String },
      ingredient_content: { type: String }
    }
  ],
  warnings: [{ type: String }],
  productuses: [{ type: String }],
  option: [
    {
      stock: { type: Number, default: 0 },
      valuesoption: { type: String },
      attribute: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId, required: true },
          name_attribute: { type: String }
        }
      ],
      price: {
        price: { type: Number, required: true },
        discontprice: { type: Number, default: 0 }
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
