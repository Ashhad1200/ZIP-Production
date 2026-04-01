export const appConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  verifyTokenExpiryHours: parseInt(process.env.VERIFY_TOKEN_EXPIRY_HOURS || '48', 10),
};
