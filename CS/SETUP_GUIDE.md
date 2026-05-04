# Creative Studio - Setup Guide (No Base44)

## ✅ What Changed

Your app no longer depends on Base44! Now it uses:
- **Supabase** for authentication and database
- **OpenRouter** (FREE) for AI content generation

---

## 🚀 Quick Setup (3 Steps)

### Optional: Azure Video Generation with Sora

Add these server variables to `.env` to enable video generation:

```env
AZURE_OPENAI_VIDEO_API_KEY=your-azure-video-api-key
AZURE_OPENAI_VIDEO_ENDPOINT=https://your-resource.openai.azure.com/openai/v1/videos
AZURE_OPENAI_VIDEO_MODEL=sora-2
```

Restart the backend after changing `.env`.

### Step 1: Get FREE AI API Key (2 minutes)

1. Go to **https://openrouter.ai/**
2. Click **Sign Up** and create an account
3. Go to **Keys** in the dashboard
4. Click **Create Key** and give it a name
5. **Copy the API key** (starts with `sk-or-...`)

### Step 2: Update `.env.local`

Open `.env.local` and replace:
```
VITE_AI_API_KEY=your-openrouter-api-key-here
```

With your actual key:
```
VITE_AI_API_KEY=sk-or-v1-your-actual-key-here
```

### Step 3: Set Up Supabase Database (1 minute)

1. Go to **https://app.supabase.com/project/enftsuaywxyeawkdgnut/sql**
2. Open the file `supabase-setup.sql` in this project
3. Copy all the SQL code
4. Paste it into the Supabase SQL Editor
5. Click **Run** to execute

---

## 📧 Fix Email Rate Limit Issue

The "email rate limit exceeded" error happens because Supabase limits sign-ups with the same email.

### Solution 1: Use Different Emails (Quick)
- Use a different email address each time you test registration
- Example: `test1@email.com`, `test2@email.com`, etc.

### Solution 2: Disable Email Confirmation (Recommended for Development)

1. Go to **https://app.supabase.com/project/enftsuaywxyeawkdgnut/auth/providers**
2. Find **Email Auth** section
3. Toggle **OFF** "Confirm email"
4. Save changes

This allows users to sign in immediately without clicking a confirmation link.

### Solution 3: Delete Test Users

1. Go to **https://app.supabase.com/project/enftsuaywxyeawkdgnut/auth/users**
2. Find the user you've been testing with
3. Click the **Delete** button
4. Now you can register again with that email

---

## 🎯 Testing Your Setup

### Test Registration:
1. Run the app: `npm run dev`
2. Go to **http://localhost:5173/register**
3. Create a new account with a unique email
4. You should be redirected to login

### Test Login:
1. Go to **http://localhost:5173/login**
2. Enter your email and password
3. You should be logged in successfully

### Test Content Generation:
1. After logging in, go to the home page
2. Select a persona
3. Fill in the topic and other fields
4. Click **Generate Content**
5. You should see 3 AI-generated variants!

---

## 🆘 Troubleshooting

### "AI API key not configured"
- Make sure you added `VITE_AI_API_KEY` to `.env.local`
- Restart the dev server after changing `.env.local`
- Run: `npm run dev`

### "Email rate limit exceeded"
- Use a different email address
- OR delete the old user from Supabase Auth dashboard
- OR disable email confirmation (see above)

### "Failed to save to history"
- Make sure you ran the `supabase-setup.sql` script
- Check Supabase dashboard for any errors

### Content generation is slow
- Free models may take 10-30 seconds
- Upgrade to a paid model in OpenRouter for faster results
- Change `VITE_AI_MODEL` in `.env.local` to a faster model

---

## 🎨 Optional: Change AI Model

OpenRouter offers many models. Edit `.env.local`:

**Free models:**
```
VITE_AI_MODEL=meta-llama/llama-3.1-8b-instruct:free
VITE_AI_MODEL=mistralai/mistral-7b-instruct:free
VITE_AI_MODEL=google/gemma-7b-it:free
```

**Paid models (cheaper, faster):**
```
VITE_AI_MODEL=openai/gpt-3.5-turbo
VITE_AI_MODEL=anthropic/claude-3-haiku
```

Browse all models: **https://openrouter.ai/models**

---

## 📝 Summary

✅ **Registration**: Works with Supabase  
✅ **Login**: Works with Supabase  
✅ **Content Generation**: Works with OpenRouter (FREE)  
✅ **History**: Saved to Supabase database  
❌ **Base44**: Completely removed!

You're now 100% independent of Base44! 🎉
