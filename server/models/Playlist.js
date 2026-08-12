import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
    },

    position: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      default: '',
    },

    artist: {
      type: String,
      default: '',
    },

    uploader: {
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

    streamUrl: {
      type: String,
      default: '',
    },

    youtubeUrl: {
      type: String,
      default: '',
    },

    lyricsAvailable: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

const schema = new mongoose.Schema(
  {
    youtubePlaylistId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      default: '',
    },

    description: {
      type: String,
      default: '',
    },

    thumbnail: {
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

    themeId: {
      type: String,
      index: true,
      default: '',
    },

    songCount: {
      type: Number,
      default: 0,
    },

    entries: {
      type: [entrySchema],
      default: [],
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Playlist', schema);
