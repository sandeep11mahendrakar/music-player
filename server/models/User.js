import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },

    avatar: {
      type: String,
      default: '',
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('User', schema);
