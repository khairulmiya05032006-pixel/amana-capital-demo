// Pagination Utility
export const getPaginationParams = (req, defaultLimit = 10, maxLimit = 100) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || defaultLimit;

  if (page < 1) page = 1;
  if (limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
};

export const createPaginationMeta = (total, limit, page) => {
  return {
    total,
    limit,
    page,
    pages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
  };
};
