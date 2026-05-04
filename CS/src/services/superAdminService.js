import { apiClient, tokenStorage } from '@/api/apiClient';

const monthKeyFormatter = new Intl.DateTimeFormat('en', { month: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const getMonthKey = (value) => {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
};

const getMonthLabel = (value) => monthKeyFormatter.format(new Date(value));

const getRelativeTime = (value) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  return dateTimeFormatter.format(new Date(value));
};

const buildMonthlyTrend = (rows) => {
  const monthlyMap = new Map();

  rows.forEach((row) => {
    const key = getMonthKey(row.created_date);
    const current = monthlyMap.get(key) ?? {
      month: getMonthLabel(row.created_date),
      generations: 0,
      apiCalls: 0,
    };

    current.generations += 1;
    current.apiCalls += 1;
    monthlyMap.set(key, current);
  });

  return Array.from(monthlyMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([, value]) => value);
};

const buildContentTypes = (rows) => {
  const total = rows.length || 1;
  const counts = rows.reduce((accumulator, row) => {
    const key = row.content_type || 'Unknown';
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
    return accumulator;
  }, new Map());

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }));
};

const buildPersonaDistribution = (rows) => {
  const counts = rows.reduce((accumulator, row) => {
    const key = row.persona_label || row.persona || 'Unknown';
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
    return accumulator;
  }, new Map());

  const palette = ['#0A66C2', '#E4405F', '#1877F2', '#1DA1F2', '#FF0000', '#22C55E'];

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([name, value], index) => ({
      name,
      value,
      color: palette[index % palette.length],
    }));
};

const buildUsageRows = (rows) => {
  const grouped = rows.reduce((accumulator, row) => {
    const key = row.persona_label || row.persona || 'Unknown';
    const current = accumulator.get(key) ?? {
      id: key,
      company: key,
      plan: 'Content History',
      creditsTotal: 100,
      creditsUsed: 0,
      creditsRemaining: 100,
      apiCalls: 0,
      lastUsed: row.created_date,
      status: 'active',
    };

    current.creditsUsed += 1;
    current.apiCalls += 1;
    if (new Date(row.created_date) > new Date(current.lastUsed)) {
      current.lastUsed = row.created_date;
    }

    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  return Array.from(grouped.values())
    .map((entry) => {
      const creditsRemaining = Math.max(entry.creditsTotal - entry.creditsUsed, 0);
      const usageRatio = entry.creditsUsed / entry.creditsTotal;
      let status = 'active';

      if (usageRatio >= 1) {
        status = 'suspended';
      } else if (usageRatio >= 0.9) {
        status = 'critical';
      } else if (usageRatio >= 0.7) {
        status = 'warning';
      }

      return {
        ...entry,
        creditsRemaining,
        status,
        lastUsed: getRelativeTime(entry.lastUsed),
      };
    })
    .sort((left, right) => right.apiCalls - left.apiCalls);
};

const buildUserRows = (rows) => {
  const grouped = rows.reduce((accumulator, row) => {
    const key = row.user_id || `anonymous-${row.persona_label || row.persona || 'unknown'}`;
    const current = accumulator.get(key) ?? {
      id: key,
      name:
        row.user_name ||
        (row.user_id ? `User ${String(row.user_id).slice(0, 8)}` : 'Anonymous User'),
      email:
        row.user_email ||
        (row.user_id ? `${String(row.user_id).slice(0, 8)}@content-history.local` : 'not-available'),
      company: row.persona_label || row.persona || 'Unknown',
      role: row.user_id ? 'user' : 'guest',
      status: 'active',
      joined: row.created_date,
      generations: 0,
    };

    if (!current.name && row.user_name) {
      current.name = row.user_name;
    }

    if ((!current.email || current.email === 'not-available') && row.user_email) {
      current.email = row.user_email;
    }

    current.generations += 1;
    if (new Date(row.created_date) < new Date(current.joined)) {
      current.joined = row.created_date;
    }

    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      joined: dateTimeFormatter.format(new Date(entry.joined)),
    }))
    .sort((left, right) => right.generations - left.generations);
};

const buildCompanyRows = (rows) => {
  const grouped = rows.reduce((accumulator, row) => {
    const key = row.persona_label || row.persona || 'Unknown';
    const current = accumulator.get(key) ?? {
      id: key,
      name: key,
      email: 'not-available',
      users: new Set(),
      plan: 'Not configured',
      status: 'active',
      joined: row.created_date,
      generations: 0,
    };

    current.generations += 1;
    if (row.user_id) {
      current.users.add(row.user_id);
    }
    if (new Date(row.created_date) < new Date(current.joined)) {
      current.joined = row.created_date;
    }

    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      users: entry.users.size,
      joined: dateTimeFormatter.format(new Date(entry.joined)),
    }))
    .sort((left, right) => right.generations - left.generations);
};

const buildProfileUserRows = (profiles) => {
  return profiles
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name || 'Unnamed User',
      email: profile.email || 'not-available',
      company: profile.company || 'Unknown',
      role: profile.role || 'user',
      status: profile.status || 'active',
      plan: profile.plan_name || 'No plan',
      joined: dateTimeFormatter.format(new Date(profile.created_at || Date.now())),
      generations: profile.generations ?? 0,
    }))
    .sort((left, right) => right.generations - left.generations);
};

const buildProfileCompanyRows = (profiles) => {
  const grouped = profiles.reduce((accumulator, profile) => {
    const key = profile.company || 'Unknown';
    const current = accumulator.get(key) ?? {
      id: key,
      name: key,
      email: 'not-available',
      users: 0,
      plan: 'Not configured',
      status: 'active',
      joined: profile.created_at || new Date().toISOString(),
      generations: 0,
    };

    current.users += 1;
    current.generations += profile.generations ?? 0;

    if (new Date(profile.created_at || Date.now()) < new Date(current.joined)) {
      current.joined = profile.created_at;
    }

    accumulator.set(key, current);
    return accumulator;
  }, new Map());

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      joined: dateTimeFormatter.format(new Date(entry.joined)),
    }))
    .sort((left, right) => right.users - left.users);
};

export async function fetchSuperAdminMetrics() {
  const token = tokenStorage.getSuperAdminToken();
  if (!token) {
    throw new Error('Super admin token not available');
  }

  const { users, rows } = await apiClient.get('/superadmin/metrics', token);
  const profiles = (users ?? []).map((profile) => ({
    ...profile,
    generations: (rows ?? []).filter((row) => row.user_id === profile._id?.toString?.() || row.user_id === profile.id).length,
  }));
  const now = new Date();
  const currentMonthRows = (rows ?? []).filter((row) => {
    const createdDate = new Date(row.created_date);
    return createdDate.getUTCFullYear() === now.getUTCFullYear() && createdDate.getUTCMonth() === now.getUTCMonth();
  });

  const uniqueUsers = profiles.length > 0
    ? new Set(profiles.map((profile) => profile.id).filter(Boolean))
    : new Set((rows ?? []).map((row) => row.user_id).filter(Boolean));
  const uniquePersonas = new Set((rows ?? []).map((row) => row.persona_label || row.persona).filter(Boolean));
  const completedRows = (rows ?? []).filter((row) => row.status === 'completed');
  const successRate = (rows ?? []).length === 0 ? 0 : Math.round((completedRows.length / (rows ?? []).length) * 1000) / 10;
  const monthlyTrend = buildMonthlyTrend(rows ?? []);
  const usageRows = buildUsageRows(rows ?? []);
  const userRows = profiles.length > 0 ? buildProfileUserRows(profiles) : buildUserRows(rows ?? []);
  const companyRows = profiles.length > 0 ? buildProfileCompanyRows(profiles) : buildCompanyRows(rows ?? []);

  return {
    totals: {
      totalGenerations: rows.length,
      generationsThisMonth: currentMonthRows.length,
      uniqueUsers: uniqueUsers.size,
      trackedPersonas: uniquePersonas.size,
      successRate,
      averageGenerationsPerPersona: uniquePersonas.size === 0 ? 0 : Math.round(rows.length / uniquePersonas.size),
    },
    recentActivity: usageRows.slice(0, 5),
    monthlyTrend,
    contentTypes: buildContentTypes(rows),
    personaDistribution: buildPersonaDistribution(rows),
    usageRows,
    userRows,
    companyRows,
    hasProfilesTable: profiles.length > 0,
  };
}

export async function fetchSuperAdminPlans() {
  const token = tokenStorage.getSuperAdminToken();
  if (!token) {
    throw new Error('Super admin token not available');
  }

  return await apiClient.get('/superadmin/plans', token);
}