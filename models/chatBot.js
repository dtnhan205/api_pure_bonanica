const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'model'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    file: {
      data: { type: String, default: null }, 
      mime_type: { type: String, default: null },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, timestamps: true }
);

chatMessageSchema.index({ sessionId: 1, timestamp: 1 });

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);