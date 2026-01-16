// Integration test setup file
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../logistics-backend/.env') });

// Global test configuration
process.env.NODE_ENV = 'test';
