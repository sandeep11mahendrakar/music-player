import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },

    activeThemeId: {
      type: String,
      default: 'set1',
    },

    volume: {
      type: Number,
      default: 1,
      min: 0,
      max: 1,
    },

    autoplay: {
      type: Boolean,
      default: true,
    },

    showLyrics: {
      type: Boolean,
      default: true,
    },

    themeTransition: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('UserPreferences', schema);
