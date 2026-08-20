function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFlatNumberFromEmail(email = '') {
  const normalized = String(email).trim().toLowerCase();
  const match = normalized.match(/(\d+)@[^@]+$/i);
  return match ? match[1] : '';
}

function getAccessScope(req, options = {}) {
  const { allowResidentWithoutFlat = false, allowResidentAll = false } = options;
  const sessionUser = req?.session?.user;
  if (!sessionUser) {
    return {
      allowed: false,
      status: 401,
      message: 'Please log in to access this data.',
      scope: 'none',
    };
  }

  const role = String(sessionUser.role || '').toLowerCase();
  const loginType = String(sessionUser.loginType || '').toLowerCase();

  if (role === 'manager' || loginType === 'reception' || role === 'admin') {
    return { allowed: true, scope: 'all', sessionUser };
  }

  return {
    allowed: false,
    status: 403,
    message: 'Only the reception desk is authorized to access this data.',
    scope: 'none',
  };
}

function buildFlatScopedRegex(flatNumber = '') {
  const safeFlat = escapeRegex(flatNumber);
  return new RegExp(`(^|\\D)${safeFlat}(\\D|$)`, 'i');
}

module.exports = {
  getAccessScope,
  buildFlatScopedRegex,
  extractFlatNumberFromEmail,
};
