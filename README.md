# Gift Card API

A simple Node.js API for managing gift cards.

## API Endpoints

- `POST /api/giftcards` - Create a new gift card
- `GET /api/giftcards` - Get all gift cards

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
MONGODB_URI=your_mongodb_uri
PORT=3000
```

3. Start the server:
```bash
npm start
```

## Deployment Instructions

### Deploying to Render.com

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Use the following settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
4. Add the following environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `PORT`: 10000 (Render will automatically assign a port)

### MongoDB Setup

For production, you can use MongoDB Atlas (free tier):
1. Create an account at MongoDB Atlas
2. Create a new cluster
3. Get your connection string
4. Add it to your environment variables as `MONGODB_URI` 