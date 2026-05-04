const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const USER_TOKEN_KEY = 'creative_studio_token';
const SUPERADMIN_TOKEN_KEY = 'creative_studio_superadmin_token';

export const tokenStorage = {
  getUserToken() {
    return window.localStorage.getItem(USER_TOKEN_KEY);
  },
  setUserToken(token) {
    window.localStorage.setItem(USER_TOKEN_KEY, token);
  },
  clearUserToken() {
    window.localStorage.removeItem(USER_TOKEN_KEY);
  },
  getSuperAdminToken() {
    return window.localStorage.getItem(SUPERADMIN_TOKEN_KEY);
  },
  setSuperAdminToken(token) {
    window.localStorage.setItem(SUPERADMIN_TOKEN_KEY, token);
  },
  clearSuperAdminToken() {
    window.localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
  },
};

async function request(path, options = {}) {
  let response;
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error('Backend API is not reachable. Start the Mongo server on http://localhost:4000 and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function xhrRequest(path, { method = 'GET', body, headers = {}, onUploadProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE_URL}${path}`);

    Object.entries(headers || {}).forEach(([key, value]) => {
      if (value != null) {
        xhr.setRequestHeader(key, value);
      }
    });

    xhr.responseType = 'text';

    xhr.onload = () => {
      const data = (() => {
        try {
          return xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          return {};
        }
      })();

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      const error = new Error(data.message || `Request failed: ${xhr.status}`);
      error.status = xhr.status;
      error.data = data;
      reject(error);
    };

    xhr.onerror = () => {
      reject(new Error('Backend API is not reachable. Start the Mongo server on http://localhost:4000 and try again.'));
    };

    if (xhr.upload && typeof onUploadProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        onUploadProgress({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) });
      };
    }

    xhr.send(body);
  });
}

export const apiClient = {
  get: (path, token) => request(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  post: (path, body, token) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body), headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  patch: (path, body, token) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}), headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  delete: (path, token) => request(path, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }),
  upload: (path, body, token, onUploadProgress) => xhrRequest(path, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {}, onUploadProgress }),
};