# MongoDB Setup Guide - Use with MongoDB Compass

## Quick Setup (5 minutes)

### Step 1: Create Free MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Sign up" and create a free account
3. Choose "Create a deployment" → Select "M0 (Free)"
4. Choose your region (closest to you)
5. Create the cluster (wait 5-10 minutes for it to be ready)

### Step 2: Get Connection String
1. Click "Connect" on your cluster
2. Choose "MongoDB Compass" as connection method
3. Copy the connection string (looks like):
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/creative_studio_os
   ```

### Step 3: Update Backend Environment Variable
Open PowerShell in the project folder and run:

```powershell
# On Windows - Run this ONCE before starting the server
$env:MONGODB_URI = "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/creative_studio_os"

# Then start the backend
node server/index.js
```

The server will automatically:
- Connect to your MongoDB Atlas cluster
- Create collections (users, plans, content_history)
- Seed initial data (superadmin user, plans)

### Step 4: Connect MongoDB Compass
1. Open MongoDB Compass (already installed on your system)
2. Paste your connection string in the URI field
3. Click "Connect"
4. You'll see your database with all collections

### Step 5: Start the App

**Terminal 1 - Start Backend:**
```powershell
cd "C:\Users\abish\Downloads\creative-studio-main\creative-studio-main"
$env:MONGODB_URI = "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/creative_studio_os"
node server/index.js
```

**Terminal 2 - Start Frontend:**
```powershell
cd "C:\Users\abish\Downloads\creative-studio-main\creative-studio-main"
npm run dev
```

Then:
- Open http://localhost:5173 in browser
- Use registration to create users
- Monitor everything in MongoDB Compass

---

## Troubleshooting

### Connection String Error
- Check you replaced `username` and `password` with your actual credentials
- Verify your IP is whitelisted in MongoDB Atlas security settings

### Can't Connect from Compass
- Make sure you're using the "MongoDB Compass" connection string (not the driver version)
- Check internet connection
- Verify firewall allows outbound to MongoDB servers

### Still Getting File Store Instead of Mongo
- The `$env:MONGODB_URI` must be set BEFORE running `node server/index.js`
- Try closing and reopening PowerShell if the env variable isn't recognized

---

## Credentials for Testing
**Super Admin Login:**
- Email: `superadmin@creativestudio.com`
- Password: `admin123`
