import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    youtubeVideoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    artist: {
      type: String,
      default: '',
    },

    uploader: {
      type: String,
      default: '',
    },

    channelId: {
      type: String,
      default: '',
    },

    channelTitle: {
      type: String,
      default: '',
    },

    album: {
      type: String,
      default: '',
    },

    duration: {
      type: Number,
      default: 0,
    },

    thumbnail: {
      type: String,
      default: '',
    },

    youtubeUrl: {
      type: String,
      default: '',
    },

    genre: {
      type: String,
      default: '',
    },

    year: {
      type: Number,
      default: null,
    },

    language: {
      type: String,
      default: '',
    },

    description: {
      type: String,
      default: '',
    },

    tags: {
      type: [String],
      default: [],
    },

    lyricsAvailable: {
      type: Boolean,
      default: false,
    },

    metadataSource: {
      type: String,
      default: 'youtube',
    },

    firstSeenAt: {
      type: Date,
      default: Date.now,
    },

    lastMetadataSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Song', schema);
