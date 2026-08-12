import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    themeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    playlistUrl: {
      type: String,
      default: '',
    },

    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      default: null,
    },

    customTitle: {
      type: String,
      default: '',
    },

    customSubtext: {
      type: String,
      default: '',
    },

    tagline: {
      type: String,
      default: '',
    },

    description: {
      type: String,
      default: '',
    },

    background: {
      type: String,
      default: '',
    },

    hero: {
      type: String,
      default: '',
    },

    overlays: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    backgroundPosition: {
      type: String,
      default: 'center center',
    },

    playerBlur: {
      type: String,
      default: '16px',
    },

    accent: {
      type: String,
      default: '',
    },

    overlay: {
      type: String,
      default: '',
    },

    overlayStrength: {
      type: Number,
      default: 0,
    },

    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Theme', schema);
