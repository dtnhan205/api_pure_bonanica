const mongoose = require('mongoose');


const commentSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user', 
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', 
      required: true
    },
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now 
    },
    updatedAt: {
      type: Date 
    },
    status: {
    type: String,
    enum: ['show', 'hidden'],
    default: 'show'
  }
  }, { versionKey: false });

module.exports = mongoose.model('Comment', commentSchema); 