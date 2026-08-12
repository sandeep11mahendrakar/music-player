import mongoose from 'mongoose';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/deluxe_saloon';

let connected = false;

export async function connectMongoDB() {
  if (mongoose.connection.readyState === 1) {
    connected = true;
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    connected = true;

    console.log(
      `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`
    );

    return mongoose.connection;
  } catch (error) {
    connected = false;

    console.warn(
      `MongoDB unavailable: ${error.message}`
    );

    return null;
  }
}

export function isMongoDBConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectMongoDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  connected = false;
}
