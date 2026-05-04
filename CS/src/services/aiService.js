/**
 * AI Content Generation Service
 * Uses OpenRouter API (free tier available) or any OpenAI-compatible API
 * 
 * Setup:
 * 1. Get a free API key from https://openrouter.ai/
 * 2. Add VITE_AI_API_KEY to your .env.local file
 * 3. Optionally configure VITE_AI_MODEL and VITE_AI_API_URL
 */

// Get API configuration dynamically
const getAIConfig = () => {
  // Check if using Azure OpenAI or standard OpenAI/OpenRouter
  const isAzure = import.meta.env.VITE_AI_PROVIDER === 'azure' || 
                  import.meta.env.VITE_AI_API_URL?.includes('azure') ||
                  import.meta.env.VITE_AI_API_URL?.includes('openai.azure.com');
  
  const config = {
    apiKey: import.meta.env.VITE_AI_API_KEY || '',
    model: import.meta.env.VITE_AI_MODEL || 'gpt-3.5-turbo',
    apiUrl: import.meta.env.VITE_AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    isAzure: isAzure,
    apiVersion: import.meta.env.VITE_AI_API_VERSION || '2024-02-15-preview',
  };

  return config;
};

/**
 * Generate content variants using AI
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - The system/user prompt
 * @returns {Promise<Array>} Array of content variants
 */
export async function generateContent(params) {
  const config = getAIConfig();
  
  if (!config.apiKey) {
    throw new Error(
      'AI API key not configured. Please add VITE_AI_API_KEY to your .env.local file.'
    );
  }

  try {
    // Build headers based on provider
    const headers = {
      'Content-Type': 'application/json',
    };

    if (config.isAzure) {
      // Azure OpenAI authentication
      headers['api-key'] = config.apiKey;
    } else {
      // OpenAI/OpenRouter authentication
      headers['Authorization'] = `Bearer ${config.apiKey}`;
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'Creative Studio OS';
    }

    // Build the request URL (Azure needs API version in URL)
    const requestUrl = config.isAzure 
      ? `${config.apiUrl}/openai/deployments/${config.model}/chat/completions?api-version=${config.apiVersion}`
      : config.apiUrl;

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: params.prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_completion_tokens: 2000, // Azure OpenAI uses this instead of max_tokens
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `AI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content generated from AI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    if (!parsed.variants || !Array.isArray(parsed.variants)) {
      throw new Error('Invalid response format from AI');
    }

    return parsed.variants;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse AI response. The model may not support JSON output.');
    }
    throw error;
  }
}

export async function generateImageAsset(params) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.post('/generate-image', params, token);
}

export async function generateVideoAsset(params) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.post('/generate-video', params, token);
}

export async function fetchVideoStatus(videoId) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.get(`/video-status/${encodeURIComponent(videoId)}`, token);
}

export async function fetchKnowledgeSources() {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.get('/knowledge-sources', token);
}

export async function createKnowledgeSource(payload) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.post('/knowledge-sources', payload, token);
}

export async function ingestKnowledgeSourceFromUrl(payload) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.post('/knowledge-sources/ingest-url', payload, token);
}

export async function ingestKnowledgeSourceFromFile(payload) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('fileName', payload.fileName || payload.file?.name || 'attachment');
  formData.append('title', payload.title || payload.fileName || payload.file?.name || 'attachment');
  formData.append('source_type', payload.source_type || 'text');

  (payload.tags || []).forEach((tag) => {
    formData.append('tags', tag);
  });

  return await apiClient.upload('/knowledge-sources/ingest-file', formData, token, payload.onUploadProgress);
}

export async function fetchKnowledgeSource(id) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.get(`/knowledge-sources/${id}`, token);
}

export async function updateKnowledgeSource(id, payload) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.patch(`/knowledge-sources/${id}`, payload, token);
}

export async function deleteKnowledgeSource(id) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.delete(`/knowledge-sources/${id}`, token);
}

export async function fetchRagContext(query) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.post('/rag/context', { query }, token);
}

/**
 * Save content to history through the backend API.
 * @param {Object} historyData - History entry data
 * @returns {Promise<Object>} Created history entry
 */
import { apiClient, tokenStorage } from '@/api/apiClient';

export async function saveToHistory(historyData) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    console.warn('User token not available, skipping history save');
    return null;
  }

  try {
    return await apiClient.post('/history', historyData, token);
  } catch (error) {
    console.warn('History save error:', error);
    return null;
  }
}

/**
 * Fetch content history from the backend API.
 * @param {number} limit - Number of entries to fetch
 * @returns {Promise<Array>} Array of history entries
 */
export async function fetchHistory(limit = 50) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  return await apiClient.get(`/history?limit=${limit}`, token);
}

/**
 * Delete a content history entry through the backend API.
 * @param {string} id - Entry ID
 * @returns {Promise<void>}
 */
export async function deleteHistoryEntry(id) {
  const token = tokenStorage.getUserToken();
  if (!token) {
    throw new Error('User token not available');
  }

  await apiClient.patch(`/history/${id}/delete`, {}, token);
}
